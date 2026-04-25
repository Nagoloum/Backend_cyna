import { Injectable } from '@nestjs/common';

import { UpdateUserDto } from './dto/update-user.dto';
import { isValidObjectId, Model } from 'mongoose';
import { User } from './entities/user.entity';
import { InjectModel } from '@nestjs/mongoose';
import { ApiResponse } from 'src/shared/responses/api-response';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
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

  async findOne(id: string) {
    try {
      const user = await this.userModel
        .findById(id)
        .select('-password -verification')
        .exec();
      if (!user) {
        return ApiResponse.error('Utilisateur introuvable');
      }
      return ApiResponse.success('Utilisateur trouvé avec succès', user);
    } catch (_error) {
      return ApiResponse.error('ID invalide ou erreur de connexion');
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
      const isAdmin = currentUser?.data?.roles?.includes('ADMIN');
      const isOwner = user.id === currentUser?.data?.id?.toString();
      if (!isOwner && !isAdmin) {
        return ApiResponse.error(
          'Vous ne pouvais pas modifier cet utilisateur',
        );
      }

      // Mise à jour du mot de passe si fourni
      if (updateUserDto.password) {
        updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
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

  async remove(id: string) {
    try {
      const deletedUser = await this.userModel.findByIdAndDelete(id).exec();
      if (!deletedUser) {
        return ApiResponse.error('Utilisateur introuvable');
      }
      return ApiResponse.success('Utilisateur supprimé avec succès');
    } catch (_error) {
      return ApiResponse.error('Erreur lors de la suppression : ');
    }
  }
}
