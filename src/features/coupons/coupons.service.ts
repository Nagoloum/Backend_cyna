import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Coupon, CouponType } from './entities/coupon.entity';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ApiResponse } from '../../shared/responses/api-response';
import { QueryDto } from '../../shared/dto/query.dto';
import { escapeRegex } from '../../shared/generic/escape-regex';

export type CouponValidation = {
  valid: boolean;
  message?: string;
  code?: string;
  type?: CouponType;
  value?: number;
  discount?: number;
};

@Injectable()
export class CouponsService {
  constructor(
    @InjectModel(Coupon.name) private readonly couponModel: Model<Coupon>,
  ) {}

  private round2(value: number): number {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  private normalizeCode(code: string): string {
    return String(code ?? '').trim().toUpperCase();
  }

  async create(dto: CreateCouponDto) {
    try {
      const code = this.normalizeCode(dto.code);
      const exists = await this.couponModel.exists({ code });
      if (exists) {
        return ApiResponse.conflict('Un coupon avec ce code existe déjà');
      }
      const created = await this.couponModel.create({ ...dto, code });
      return ApiResponse.success('Coupon créé avec succès', created);
    } catch (_error) {
      return ApiResponse.error('Erreur lors de la création du coupon');
    }
  }

  async findAll(query?: QueryDto) {
    try {
      const { page, limit, search } = query ?? {};
      const filter: Record<string, any> = {};
      if (search) {
        filter.code = { $regex: escapeRegex(String(search)), $options: 'i' };
      }

      if (!page && !limit) {
        const all = await this.couponModel
          .find(filter)
          .sort({ createdAt: -1 })
          .exec();
        return ApiResponse.success('Liste des coupons récupérée', all);
      }

      const p = Math.max(1, Number(page) || 1);
      const l = Math.max(1, Number(limit) || 10);
      const [data, total] = await Promise.all([
        this.couponModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip((p - 1) * l)
          .limit(l)
          .exec(),
        this.couponModel.countDocuments(filter),
      ]);
      return ApiResponse.success('Liste des coupons récupérée', {
        data,
        total,
        page: p,
        limit: l,
        totalPage: Math.ceil(total / l),
      });
    } catch (_error) {
      return ApiResponse.error('Erreur lors de la récupération des coupons');
    }
  }

  async update(id: string, dto: UpdateCouponDto) {
    try {
      const patch: Record<string, any> = { ...dto };
      if (dto.code) patch.code = this.normalizeCode(dto.code);
      const updated = await this.couponModel
        .findByIdAndUpdate(id, patch, { new: true })
        .exec();
      if (!updated) return ApiResponse.notFound('Coupon introuvable');
      return ApiResponse.success('Coupon mis à jour', updated);
    } catch (_error) {
      return ApiResponse.error('Erreur lors de la mise à jour du coupon');
    }
  }

  async remove(id: string) {
    try {
      const deleted = await this.couponModel.findByIdAndDelete(id).exec();
      if (!deleted) return ApiResponse.notFound('Coupon introuvable');
      return ApiResponse.success('Coupon supprimé');
    } catch (_error) {
      return ApiResponse.error('Erreur lors de la suppression du coupon');
    }
  }

  // Valide un code pour un montant HT donné et calcule la remise. Logique pure
  // réutilisée à la fois par l'endpoint public et par la création de commande
  // (la remise authoritative est toujours recalculée côté serveur).
  async validateCode(code: string, amountHT: number): Promise<CouponValidation> {
    const normalized = this.normalizeCode(code);
    if (!normalized) return { valid: false, message: 'Code promo requis' };

    const coupon = await this.couponModel.findOne({ code: normalized }).exec();
    if (!coupon) return { valid: false, message: 'Code promo invalide' };
    if (!coupon.active) return { valid: false, message: 'Code promo inactif' };

    const now = Date.now();
    if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) {
      return { valid: false, message: "Ce code promo n'est pas encore actif" };
    }
    if (coupon.endsAt && new Date(coupon.endsAt).getTime() < now) {
      return { valid: false, message: 'Ce code promo a expiré' };
    }
    if (coupon.maxUsage > 0 && coupon.usedCount >= coupon.maxUsage) {
      return { valid: false, message: "Ce code promo a atteint sa limite d'utilisation" };
    }
    if (coupon.minAmount > 0 && Number(amountHT) < coupon.minAmount) {
      return {
        valid: false,
        message: `Montant minimum de ${coupon.minAmount} € requis pour ce code`,
      };
    }

    const base = Number(amountHT) || 0;
    const rawDiscount =
      coupon.type === CouponType.PERCENT
        ? (base * coupon.value) / 100
        : Math.min(coupon.value, base);
    const discount = this.round2(Math.max(0, Math.min(rawDiscount, base)));

    return {
      valid: true,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      discount,
    };
  }

  // Endpoint public : enveloppe la validation dans une ApiResponse.
  async validateForResponse(code: string, amountHT: number) {
    const result = await this.validateCode(code, amountHT);
    if (!result.valid) {
      return ApiResponse.error(result.message ?? 'Code promo invalide');
    }
    return ApiResponse.success('Code promo valide', result);
  }

  // Incrémente le compteur d'usage (appelé une fois la commande payée).
  async incrementUsage(code: string): Promise<void> {
    try {
      await this.couponModel.updateOne(
        { code: this.normalizeCode(code) },
        { $inc: { usedCount: 1 } },
      );
    } catch {
      // Ne bloque jamais le flux de paiement.
    }
  }
}
