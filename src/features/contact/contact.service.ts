import { Injectable } from '@nestjs/common';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { InjectModel } from '@nestjs/mongoose';
import { concat } from 'rxjs';
import { Contact, StatutContact } from './entities/contact.entity';
import { Model, isValidObjectId } from 'mongoose';
import { ApiResponse } from '../../shared/responses/api-response';
import { AnalyticsService } from '../../shared/services/analytics.service';
import { SendEmailService } from '../../shared/services/sendemail.service';
import { QueryDto } from '../../shared/dto/query.dto';
import { escapeRegex } from '../../shared/generic/escape-regex';

@Injectable()
export class ContactService {
  constructor(
    @InjectModel(Contact.name) private contactModel: Model<Contact>,
    private readonly analyticsService: AnalyticsService,
    private readonly sendEmailService: SendEmailService,
  ) { }

  async create(createContactDto: CreateContactDto) {
    const newContact = new this.contactModel(createContactDto);
    const data = await newContact.save();
    // Evenement metier (sans donnee personnelle) : message de contact envoye.
    this.analyticsService.track('contact_submitted');
    return ApiResponse.success('Contact ajouté');;
  }

  // Rétro-compatible : sans page/limit → liste complète ; avec → pagination
  // serveur + recherche (email/sujet/message), triée du plus récent au plus ancien.
  async findAll(query?: QueryDto) {
    try {
      const { page, limit, search } = query ?? {};

      const filter: Record<string, any> = {};
      if (search) {
        const rx = { $regex: escapeRegex(String(search)), $options: 'i' };
        filter.$or = [{ email: rx }, { subject: rx }, { message: rx }];
      }

      if (!page && !limit) {
        const allContacts = await this.contactModel
          .find(filter)
          .sort({ createdAt: -1 })
          .exec();
        return ApiResponse.success(
          'Liste des contacts récupérée',
          allContacts,
        );
      }

      const p = Math.max(1, Number(page) || 1);
      const l = Math.max(1, Number(limit) || 10);
      const [data, total] = await Promise.all([
        this.contactModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip((p - 1) * l)
          .limit(l)
          .exec(),
        this.contactModel.countDocuments(filter),
      ]);

      return ApiResponse.success('Liste des contacts récupérée', {
        data,
        total,
        page: p,
        limit: l,
        totalPage: Math.ceil(total / l),
      });
    } catch (_error) {
      return ApiResponse.error(
        'Erreur lors de la récupération des messages de contact',
      );
    }
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

  // Réponse du support : enregistre la réponse, passe le ticket à REPLIED et
  // envoie l'email au client. L'échec d'envoi n'empêche pas l'enregistrement.
  async reply(id: string, message: string) {
    try {
      if (!isValidObjectId(id)) {
        return ApiResponse.error("L'id du message est invalide");
      }
      if (!message || !String(message).trim()) {
        return ApiResponse.error('La réponse ne peut pas être vide');
      }
      const contact = await this.contactModel.findById(id).exec();
      if (!contact) {
        return ApiResponse.notFound('Message introuvable');
      }

      contact.reply = String(message).trim();
      contact.status = StatutContact.REPLIED;
      contact.repliedAt = new Date().toISOString();
      await contact.save();

      try {
        await this.sendEmailService.sendContactReply(
          contact.email,
          contact.subject,
          contact.reply,
          contact.message,
        );
      } catch {
        console.error('[CONTACT] Echec envoi email de reponse');
      }

      return ApiResponse.success('Réponse envoyée', contact);
    } catch (_error) {
      return ApiResponse.error("Erreur lors de l'envoi de la réponse");
    }
  }

  // Changement de statut du ticket (lu, résolu…).
  async setStatus(id: string, status: string) {
    try {
      if (!isValidObjectId(id)) {
        return ApiResponse.error("L'id du message est invalide");
      }
      if (!Object.values(StatutContact).includes(status as StatutContact)) {
        return ApiResponse.error('Statut invalide');
      }
      const updated = await this.contactModel
        .findByIdAndUpdate(id, { status }, { new: true })
        .exec();
      if (!updated) {
        return ApiResponse.notFound('Message introuvable');
      }
      return ApiResponse.success('Statut mis à jour', updated);
    } catch (_error) {
      return ApiResponse.error('Erreur lors de la mise à jour du statut');
    }
  }

  async remove(id: string) {
    const deletedContact = await this.contactModel.findByIdAndDelete(id).exec();
    return ApiResponse.success('Contact supprimé avec succès');
  }
}
