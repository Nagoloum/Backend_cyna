import { Injectable } from '@nestjs/common';
import { CreateCarteBancaireDto } from './dto/create-carte_bancaire.dto';
import { UpdateCarteBancaireDto } from './dto/update-carte_bancaire.dto';
import { ApiResponse } from 'src/shared/responses/api-response';
import { InjectModel } from '@nestjs/mongoose';
import { CarteBancaire } from './entities/carte_bancaire.entity';
import { isValidObjectId, Model } from 'mongoose';
import { UserRoles } from 'src/shared/common/user-roles.enum';

@Injectable()
export class CarteBancairesService {
  constructor(
    @InjectModel(CarteBancaire.name)
    private carteBancaireModel: Model<CarteBancaire>,
  ) {}
  async create(
    createCarteBancaireDto: CreateCarteBancaireDto,
    currentUser: any,
  ) {
    try {
      const exist = await this.carteBancaireModel.exists({
        carteNumber: createCarteBancaireDto.carteNumber,
        user: currentUser?.data?._id,
      });

      if (exist) {
        return ApiResponse.error('Cette carte bancaire existe deja');
      }
      const newCarteBancaire = new this.carteBancaireModel({
        ...createCarteBancaireDto,
        user: currentUser?.data?._id,
      });

      const savedCarteBancaire = await newCarteBancaire.save();
      return ApiResponse.success(
        'Carte bancaire crée avec success',
        savedCarteBancaire,
      );
    } catch (error) {
      return ApiResponse.error(
        "Erreur lors de la création de l'adresse de facturation",
      );
    }
  }

  async findByUser(currentUser: any) {
    try {
      const carteBancaire = await this.carteBancaireModel.find({
        user: currentUser?.data?._id,
      });
      return ApiResponse.success(
        'Carte bancaire recuperee avec success',
        carteBancaire,
      );
    } catch (error) {
      return ApiResponse.error(
        "Erreur lors de la recupération de la carte bancaire de l'utilisateur",
      );
    }
  }

  async findOne(id: string, currentUser: any) {
    try {
      if (!isValidObjectId(id)) {
        return ApiResponse.error("L'id est invalide");
      }
      const carteBancaire = await this.carteBancaireModel.findById(id);

      if (!carteBancaire) {
        return ApiResponse.error('Carte bancaire non trouvee');
      }
      // --- 2) Autorisations ---
      const isAdmin = UserRoles.ADMIN.includes(currentUser?.data?.role);
      const isOwner = carteBancaire?.user?.equals(currentUser?.data?._id);

      if (!isOwner && !isAdmin) {
        return ApiResponse.error(
          "Vous n'êtes pas propriétaire de cette carte bancaire",
        );
      }
      return ApiResponse.success(
        'Adresse de facturation recuperee avec success',
        carteBancaire,
      );
    } catch (error) {
      return ApiResponse.error(
        'Erreur lors de la recupération de la carte bancaire',
      );
    }
  }

  async update(
    id: string,
    updateCarteBancaireDto: UpdateCarteBancaireDto,
    currentUser: any,
  ) {
    try {
      if (!isValidObjectId(id)) {
        return ApiResponse.error("L'id est invalide");
      }
      const carteBancaire = await this.carteBancaireModel.findById(
        id,
        '_id user',
      );

      if (!carteBancaire) {
        return ApiResponse.error('Carte bancaire non trouvee');
      }
      // --- 2) Autorisations ---
      const isAdmin = UserRoles.ADMIN.includes(currentUser?.data?.role);
      const isOwner = carteBancaire?.user?.equals(currentUser?.data?._id);

      if (!isOwner && !isAdmin) {
        return ApiResponse.error(
          "Vous n'êtes pas propriétaire de cette carte bancaire",
        );
      }

      return ApiResponse.success(
        'Adresse de facturation mise a jour avec success',
        await this.carteBancaireModel.findByIdAndUpdate(id, {
          $set: updateCarteBancaireDto,
        }),
      );
    } catch (error) {
      return ApiResponse.error(
        'Erreur lors de la mise à jour de la carte bancaire',
      );
    }
  }

  async remove(id: string, currentUser: any) {
    try {
      if (!isValidObjectId(id)) {
        return ApiResponse.error("L'id est invalide");
      }
      const carteBancaire = await this.carteBancaireModel.findById(
        id,
        '_id user',
      );

      if (!carteBancaire) {
        return ApiResponse.error('carte bancaire non trouvee');
      }
      // --- 2) Autorisations ---
      const isAdmin = UserRoles.ADMIN.includes(currentUser?.data?.role);
      const isOwner = carteBancaire?.user?.equals(currentUser?.data?._id);

      if (!isOwner && !isAdmin) {
        return ApiResponse.error(
          "Vous n'êtes pas propriétaire de cette carte bancaire",
        );
      }
      await this.carteBancaireModel.findByIdAndDelete(id);

      return ApiResponse.success('Carte bancaire supprimee avec success');
    } catch (error) {
      return ApiResponse.error(
        'Erreur lors de la suppression de la carte bancaire',
      );
    }
  }
}
