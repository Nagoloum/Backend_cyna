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

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly sharedService: SharedService,
  ) {}
  async findAll() {
    try {
      const allUsers = await this.userModel.find().select('-password').exec();

      // Mongoose renvoie [] si la collection est vide
      if (allUsers.length === 0) {
        return ApiResponse.success('Aucun utilisateur pour le moment', []);
      }

      return ApiResponse.success('Liste des utilisateurs récupérée', allUsers);
    } catch (_error) {
      return ApiResponse.error(
        'Une erreur est survenue lors de la récupération : ',
      );
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
          return ApiResponse.error('Accès refusé');
        }
      }
      const user = await this.userModel
        .findById(id)
        .select('-password -verification -twoFactorSecret')
        .exec();
      if (!user) {
        return ApiResponse.error('Utilisateur introuvable');
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
        return ApiResponse.error('Utilisateur introuvable');
      }

      // --- 2) Autorisations ---
      // Le payload JWT expose `role` (singulier) : comparaison stricte.
      const isAdmin = currentUser?.data?.role === 'ADMIN';
      const isOwner = user.id === currentUser?.data?._id?.toString();
      if (!isOwner && !isAdmin) {
        return ApiResponse.error(
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
        return ApiResponse.error('Utilisateur introuvable');
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
        return ApiResponse.error('Accès refusé');
      }
      const deletedUser = await this.userModel.findByIdAndDelete(id).exec();
      if (!deletedUser) {
        return ApiResponse.error('Utilisateur introuvable');
      }
      return ApiResponse.success('Utilisateur supprimé avec succès');
    } catch (_error) {
      return ApiResponse.error('Erreur lors de la suppression');
    }
  }
}
