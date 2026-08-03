import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog } from './entities/audit-log.entity';
import { ApiResponse } from '../../shared/responses/api-response';
import { QueryDto } from '../../shared/dto/query.dto';
import { escapeRegex } from '../../shared/generic/escape-regex';

export type AuditEntry = {
  action: string;
  actorId?: string;
  actorEmail?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, any>;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLog>,
  ) {}

  // Enregistre une entrée d'audit. Ne casse JAMAIS le flux métier : toute
  // erreur d'écriture est journalisée puis avalée. On attend l'écriture pour
  // qu'elle aboutisse avant la fin de la fonction (serverless), mais sans
  // jamais propager d'exception à l'appelant.
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.auditModel.create(entry);
    } catch (error) {
      this.logger.warn(`Echec d'écriture du journal d'audit (${entry.action})`);
    }
  }

  // Listing paginé (admin), du plus récent au plus ancien, avec recherche sur
  // action / email de l'auteur / cible.
  async findAll(query?: QueryDto) {
    try {
      const { page, limit, search } = query ?? {};
      const filter: Record<string, any> = {};
      if (search) {
        const rx = { $regex: escapeRegex(String(search)), $options: 'i' };
        filter.$or = [{ action: rx }, { actorEmail: rx }, { targetId: rx }];
      }

      const p = Math.max(1, Number(page) || 1);
      const l = Math.max(1, Number(limit) || 20);
      const [data, total] = await Promise.all([
        this.auditModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip((p - 1) * l)
          .limit(l)
          .exec(),
        this.auditModel.countDocuments(filter),
      ]);

      return ApiResponse.success("Journal d'audit récupéré", {
        data,
        total,
        page: p,
        limit: l,
        totalPage: Math.ceil(total / l),
      });
    } catch (_error) {
      return ApiResponse.error(
        "Erreur lors de la récupération du journal d'audit",
      );
    }
  }
}
