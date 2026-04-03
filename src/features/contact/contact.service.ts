import { Injectable } from '@nestjs/common';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { InjectModel } from '@nestjs/mongoose';
import { concat } from 'rxjs';
import { Contact } from './entities/contact.entity';
import { Model } from 'mongoose';
import { ApiResponse } from 'src/shared/responses/api-response';

@Injectable()
export class ContactService {
  constructor(
    @InjectModel(Contact.name) private contactModel: Model<Contact>,
  ) { }

  async create(createContactDto: CreateContactDto) {
    const newContact = new this.contactModel(createContactDto);
    const data = await newContact.save();
    return ApiResponse.success('Contact ajouté');;
  }

  async findAll() {
    const allContacts = await this.contactModel.find().exec();
    if (allContacts.length === 0) {
      return ApiResponse.success('Aucun contact enregistré', []);
    }
    return ApiResponse.success('Liste des contacts récupérée', allContacts);
  }

  async findOne(id: string) {
    const contact = await this.contactModel.findById(id).exec();
    if (!contact) {
      return ApiResponse.success("Aucun contact trouvé");
    }
    return ApiResponse.success('Contact récupéré avec succès', contact);
  }


  async update(id: string, updateContactDto: UpdateContactDto) {
    const updatedContact = await this.contactModel
      .findByIdAndUpdate(id, updateContactDto, { new: true }) // { new: true } pour retourner l'objet modifié
      .exec();

    if (!updatedContact) {
      return ApiResponse.success(`Impossible de modifier : Contact ${id} introuvable`);
    }
    return ApiResponse.success('Contact mis à jour avec succès', updatedContact);
  }

  async remove(id: string) {
    const deletedContact = await this.contactModel.findByIdAndDelete(id).exec();
    return ApiResponse.success('Contact supprimé avec succès');
  }
}
