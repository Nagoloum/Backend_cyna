import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ContactService } from './contact.service';
import { QueryDto } from '../../shared/dto/query.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { AuthorizeGuard } from '../../shared/guards/authorization.guard';
import { AuthorizeRoles } from '../../shared/decorators/authorize-roles.decorator';
import { UserRoles } from '../../shared/common/user-roles.enum';

@Controller('contact')
@ApiConsumes('multipart/form-data')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  // Formulaire public : rate-limité pour empêcher le spam.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  create(@Body() createContactDto: CreateContactDto) {
    return this.contactService.create(createContactDto);
  }

  // La lecture/gestion des messages est réservée aux admins.
  @ApiBearerAuth()
  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @Get()
  findAll(@Query() queryDto: QueryDto) {
    return this.contactService.findAll(queryDto);
  }

  @ApiBearerAuth()
  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contactService.findOne(id);
  }

  @ApiBearerAuth()
  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateContactDto: UpdateContactDto) {
    return this.contactService.update(id, updateContactDto);
  }

  // Répondre à un message : enregistre la réponse + email au client (admin).
  @ApiBearerAuth()
  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @Patch(':id/reply')
  reply(@Param('id') id: string, @Body() body: { message: string }) {
    return this.contactService.reply(id, body?.message);
  }

  // Changer le statut d'un ticket (NEW/READ/REPLIED/CLOSED) — admin.
  @ApiBearerAuth()
  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.contactService.setStatus(id, body?.status);
  }

  @ApiBearerAuth()
  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    // Suppression du '+' car MongoDB utilise des IDs de type string (ObjectIDs)
    return this.contactService.remove(id);
  }
}
