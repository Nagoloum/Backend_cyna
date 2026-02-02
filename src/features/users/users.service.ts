import { ConsoleLogger, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Model } from 'mongoose';
import { User } from './entities/user.entity';
import { InjectModel } from '@nestjs/mongoose';
import { ApiResponse } from 'src/shared/responses/api-response';
import { Console } from 'console';


@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) { }
  async findAll() {
    try {
      const allUsers = await this.userModel.find().select('-password').exec();

      // Mongoose renvoie [] si la collection est vide
      if (allUsers.length === 0) {
        return ApiResponse.success("Aucun utilisateur pour le moment", []);
      }

      return ApiResponse.success("Liste des utilisateurs récupérée", allUsers);
    } catch (error) {
      return ApiResponse.error(
        'Une erreur est survenue lors de la récupération : ' + error.message,
      );
    }
  }

  async findOne(id: string) {
    try {
      const user = await this.userModel.findById(id).select('-password').exec();
      if (!user) {
        return ApiResponse.error("Utilisateur introuvable");
      }
      return ApiResponse.success("Utilisateur trouvé avec succès", user);
    } catch (error) {
      return ApiResponse.error(
        'ID invalide ou erreur de connexion : ' + error.message,
      );
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    try {
      const updatedUser = await this.userModel
        .findByIdAndUpdate(id, updateUserDto, { new: true })
        .exec();
      if (!updatedUser) {
        return ApiResponse.error("Utilisateur introuvable pour la mise à jour");
      }
      return ApiResponse.success("Utilisateur mis à jour avec succès", updatedUser);
    } catch (error) {
      return ApiResponse.error("Erreur lors de la mise à jour : " + error.message);
    }
  }

  async remove(id: string) {
    try {
      const deletedUser = await this.userModel.findByIdAndDelete(id).exec();
      if (!deletedUser) {
        return ApiResponse.error("Utilisateur introuvable");
      }
      return ApiResponse.success("Utilisateur supprimé avec succès");
    } catch (error) {
      return ApiResponse.error("Erreur lors de la suppression : " + error.message);
    }
  }
}
