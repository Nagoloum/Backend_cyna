import { Injectable } from '@nestjs/common';

import { UpdateUserDto } from './dto/update-user.dto';
import { isValidObjectId, Model, Types } from 'mongoose';
import { User } from './entities/user.entity';
import { InjectModel } from '@nestjs/mongoose';
import { ApiResponse } from '../../shared/responses/api-response';
import * as bcrypt from 'bcrypt';
import { Type } from 'class-transformer';
import { ChangePasswordProfilDto } from './dto/create-user.dto';
import { SharedService } from '../../shared/services/shared.service';
import { QueryDto } from '../../shared/dto/query.dto';
import { escapeRegex } from '../../shared/generic/escape-regex';
import { AuditService } from '../audit/audit.service';
import { randomUUID } from 'crypto';

const USER_PUBLIC_SELECT = '-password -verification -twoFactorSecret';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly sharedService: SharedService,
    private readonly auditService: AuditService,
  ) {}

  // Rétro-compatible : sans page/limit on renvoie toute la liste (utilisé par le
  // dashboard pour les comptages) ; avec page/limit on pagine (page admin).
  async findAll(query?: QueryDto) {
    try {
      const { page, limit, search, sortBy, sortOrder } = query ?? {};

      const filter: Record<string, any> = {};
      if (search) {
        const rx = { $regex: escapeRegex(String(search)), $options: 'i' };
        filter.$or = [{ email: rx }, { firstName: rx }, { lastName: rx }];
      }

      if (!page && !limit) {
        const allUsers = await this.userModel
          .find(filter)
          .select(USER_PUBLIC_SELECT)
          .exec();
        return ApiResponse.success(
          'Liste des utilisateurs récupérée',
          allUsers,
        );
      }

      const p = Math.max(1, Number(page) || 1);
      const l = Math.max(1, Number(limit) || 10);
      const allowedSort = ['email', 'firstName', 'lastName', 'role', 'createdAt'];
      const sortField = allowedSort.includes(String(sortBy))
        ? String(sortBy)
        : 'createdAt';
      const sort: Record<string, 1 | -1> = {
        [sortField]: sortOrder === 'asc' ? 1 : -1,
      };

      const [data, total] = await Promise.all([
        this.userModel
          .find(filter)
          .select(USER_PUBLIC_SELECT)
          .sort(sort)
          .skip((p - 1) * l)
          .limit(l)
          .exec(),
        this.userModel.countDocuments(filter),
      ]);

      return ApiResponse.success('Liste des utilisateurs récupérée', {
        data,
        total,
        page: p,
        limit: l,
        totalPage: Math.ceil(total / l),
      });
    } catch (_error) {
      return ApiResponse.error(
        'Une erreur est survenue lors de la récupération : ',
      );
    }
  }

  // Crée un compte lors d'un achat invité. Refuse si l'email a déjà un compte
  // (l'invité doit alors se connecter). Génère un jeton "définir mot de passe"
  // (à usage unique, 7 jours) renvoyé pour l'email de bienvenue.
  async createGuest(dto: {
    email: string;
    firstName: string;
    lastName: string;
  }) {
    try {
      const existing = await this.userModel
        .findOne({ email: dto.email })
        .exec();
      if (existing) {
        return ApiResponse.conflict(
          'Un compte existe déjà pour cet email. Veuillez vous connecter.',
        );
      }

      // Mot de passe aléatoire : l'utilisateur le définira via l'email de bienvenue.
      const randomPassword = await bcrypt.hash(
        `${randomUUID()}-${Date.now()}`,
        10,
      );
      const jti = randomUUID();
      const user = await this.userModel.create({
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        password: randomPassword,
        confirmed: false,
        isActive: true,
        resetPasswordJti: jti,
      });

      const setupToken = this.sharedService.resetPasswordToken(user, jti, '7d');

      await this.auditService.record({
        action: 'user.guest_created',
        actorId: user._id.toString(),
        actorEmail: user.email,
      });

      return ApiResponse.success('Compte invité créé', { user, setupToken });
    } catch (_error) {
      return ApiResponse.error('Erreur lors de la création du compte invité');
    }
  }

  // Suspension / réactivation d'un compte par un administrateur.
  async setUserActive(id: string, isActive: unknown, currentUser: any) {
    try {
      if (!isValidObjectId(id)) {
        return ApiResponse.error("L'id est invalide");
      }
      if (isActive === undefined || isActive === null) {
        return ApiResponse.error('Le paramètre isActive est requis');
      }
      const active = isActive === true || isActive === 'true';

      // Garde-fou : un admin ne peut pas suspendre son propre compte.
      if (!active && currentUser?.data?._id?.toString() === id) {
        return ApiResponse.error(
          'Vous ne pouvez pas suspendre votre propre compte',
        );
      }

      const updated = await this.userModel
        .findByIdAndUpdate(id, { isActive: active }, { new: true })
        .select(USER_PUBLIC_SELECT)
        .exec();
      if (!updated) {
        return ApiResponse.notFound('Utilisateur introuvable');
      }
      await this.auditService.record({
        action: active ? 'user.reactivated' : 'user.suspended',
        actorId: currentUser?.data?._id?.toString(),
        actorEmail: currentUser?.data?.email,
        targetType: 'user',
        targetId: id,
      });
      return ApiResponse.success(
        active ? 'Utilisateur réactivé' : 'Utilisateur suspendu',
        updated,
      );
    } catch (_error) {
      return ApiResponse.error('Erreur lors de la mise à jour du statut');
    }
  }

  // `requester` est optionnel car l'AuthGuard utilise aussi findOne pour
  // charger l'utilisateur du token (sans contexte de requérant).
  async findOne(id: string, requester?: any) {
    try {
      if (requester !== undefined) {
        const isAdmin = requester?.data?.role === 'ADMIN';
        const isOwner = requester?.data?._id?.toString() === id;
        if (!isOwner && !isAdmin) {
          return ApiResponse.forbidden('Accès refusé');
        }
      }
      const user = await this.userModel
        .findById(id)
        .select('-password -verification -twoFactorSecret')
        .exec();
      if (!user) {
        return ApiResponse.notFound('Utilisateur introuvable');
      }
      return ApiResponse.success('Utilisateur trouvé avec succès', user);
    } catch (_error) {
      return ApiResponse.error('Une erreur est survenue');
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto, currentUser: any) {
    try {
      if (!isValidObjectId(id)) {
        return ApiResponse.error("L'id est invalide");
      }

      const user = await this.userModel.findById(id, '_id role').exec();
      if (!user) {
        return ApiResponse.notFound('Utilisateur introuvable');
      }

      // --- 2) Autorisations ---
      // Le payload JWT expose `role` (singulier) : comparaison stricte.
      const isAdmin = currentUser?.data?.role === 'ADMIN';
      const isOwner = user.id === currentUser?.data?._id?.toString();
      if (!isOwner && !isAdmin) {
        return ApiResponse.forbidden(
          'Vous ne pouvais pas modifier cet utilisateur',
        );
      }
      const updatedUser = await this.userModel
        .findByIdAndUpdate(id, updateUserDto, { new: true })
        .select('-password')
        .exec();

      return ApiResponse.success(
        'Utilisateur mis à jour avec succès',
        updatedUser,
      );
    } catch (error) {
      return ApiResponse.error('Erreur lors de la mise à jour');
    }
  }

  async changePassword(
    changePasswordDto: ChangePasswordProfilDto,
    currentUser: any,
  ) {
    try {
      const user = await this.userModel
        .findById({ _id: new Types.ObjectId(currentUser.data._id) })
        .exec();
      if (!user) {
        return ApiResponse.notFound('Utilisateur introuvable');
      }

      if (
        (await bcrypt.compare(
          changePasswordDto.currentPassword,
          user.password,
        )) === false
      ) {
        return ApiResponse.error('Mot de passe actuel est incorrect');
      }
      if (
        changePasswordDto.newPassword &&
        !this.sharedService.isStrongPassword(changePasswordDto.newPassword)
      ) {
        return ApiResponse.error(
          'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.',
        );
      }
      if (changePasswordDto.newPassword !== changePasswordDto.confirmPassword) {
        return ApiResponse.error(
          'Le nouveau mot de passe et la confirmation ne correspondent pas',
        );
      }

      // Mise à jour du mot de passe si fourni
      if (changePasswordDto.newPassword) {
        changePasswordDto.newPassword = await bcrypt.hash(
          changePasswordDto.newPassword,
          10,
        );
      }

      await this.userModel
        .findByIdAndUpdate(
          user.id,
          { password: changePasswordDto.newPassword },
          { new: true },
        )

        .exec();

      return ApiResponse.success('Mot de passe mis à jour avec succès');
    } catch (error) {
      return ApiResponse.error('Erreur lors de la mise à jour');
    }
  }

  async remove(id: string, currentUser?: any) {
    try {
      // Seul le propriétaire du compte ou un admin peut le supprimer.
      const isAdmin = currentUser?.data?.role === 'ADMIN';
      const isOwner = currentUser?.data?._id?.toString() === id;
      if (!isOwner && !isAdmin) {
        return ApiResponse.forbidden('Accès refusé');
      }
      const deletedUser = await this.userModel.findByIdAndDelete(id).exec();
      if (!deletedUser) {
        return ApiResponse.notFound('Utilisateur introuvable');
      }
      await this.auditService.record({
        action: 'user.deleted',
        actorId: currentUser?.data?._id?.toString(),
        actorEmail: currentUser?.data?.email,
        targetType: 'user',
        targetId: id,
      });
      return ApiResponse.success('Utilisateur supprimé avec succès');
    } catch (_error) {
      return ApiResponse.error('Erreur lors de la suppression');
    }
  }
}
