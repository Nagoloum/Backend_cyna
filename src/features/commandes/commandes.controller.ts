import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ValidationPipe,
  Query,
  Req,
  Res,
  Headers,
  NotFoundException,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { CommandesService } from './commandes.service';
import { AbonnementsService } from './abonnements.service';
import { InvoiceService } from '../../shared/services/invoice.service';
import { GuestCheckoutDto } from './dto/guest-checkout.dto';
import { CreateCommandeDto } from './dto/create-commande.dto';
import { UpdateCommandeDto } from './dto/update-commande.dto';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AuthorizeRoles } from '../../shared/decorators/authorize-roles.decorator';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { FormDataTransformPipe } from '../../shared/pipes/formdata-transform.pipe';
import { CurrentUser } from '../../shared/decorators/current-user.decorators';
import { QueryDto } from '../../shared/dto/query.dto';
import { UserRoles } from '../../shared/common/user-roles.enum';
import { AuthorizeGuard } from '../../shared/guards/authorization.guard';
import { ApiResponse } from '../../shared/responses/api-response';
import { NoFilesInterceptor } from '@nestjs/platform-express';

@ApiTags('Commandes')
@ApiBearerAuth()
@Controller('commandes')
export class CommandesController {
  constructor(
    private readonly commandesService: CommandesService,
    private readonly abonnementsService: AbonnementsService,
    private readonly invoiceService: InvoiceService,
  ) {}

  // Endpoint pour créer une commande avec Stripe Checkout
  @UseGuards(AuthGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(NoFilesInterceptor())
  @Post('create')
  createOrderWithStripe(
    @Body(FormDataTransformPipe, ValidationPipe)
    createCommandeDto: any,
    @CurrentUser() currentUser: any,
  ) {
    return this.commandesService.createWithStripeCheckout(
      createCommandeDto,
      currentUser,
    );
  }

  // Achat invité (public) : crée un compte + commande sans connexion préalable.
  // Rate-limité pour limiter les abus.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('guest-checkout')
  guestCheckout(@Body(ValidationPipe) dto: GuestCheckoutDto) {
    return this.commandesService.guestCheckout(dto);
  }

  // Endpoint pour confirmer le paiement (appelé par le frontend authentifié,
  // la vérification de propriété est faite dans le service).
  @UseGuards(AuthGuard)
  @Get('payment/success')
  paymentSuccess(
    @CurrentUser() currentUser: any,
    @Query('orderId') orderId?: string,
    @Query('session_id') sessionId?: string,
    @Query('payment_intent') paymentIntentId?: string,
  ) {
    return this.commandesService.confirmPaymentSuccess(
      orderId,
      sessionId,
      paymentIntentId,
      currentUser,
    );
  }

  // Endpoint pour gérer l'annulation du paiement
  @UseGuards(AuthGuard)
  @Get('payment/cancel')
  paymentCancel(@Query('orderId') orderId?: string) {
    return ApiResponse.error('Paiement annulé');
  }

  // Seuls les admins peuvent voir toutes les commandes, les autres utilisateurs ne verront que leurs commandes
  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @Get()
  findAll(@Query() queryDto: QueryDto) {
    return this.commandesService.findAll(queryDto);
  }

  // Seuls les admins peuvent voir toutes les commandes, les autres utilisateurs ne verront que leurs commandes
  @UseGuards(AuthGuard)
  @Get('by-user')
  findAllByUser(@Query() queryDto: QueryDto, @CurrentUser() currentUser: any) {
    return this.commandesService.findAllByUser(queryDto, currentUser);
  }

  @UseGuards(AuthGuard)
  @Get(':reference')
  findOne(
    @Param('reference') reference: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.commandesService.findOne(reference, currentUser);
  }

  // Télécharge la facture PDF d'une commande (générée à la volée). Le contrôle
  // de propriété est délégué à findOne (propriétaire ou admin uniquement).
  @UseGuards(AuthGuard)
  @Get(':reference/facture')
  async downloadInvoice(
    @Param('reference') reference: string,
    @CurrentUser() currentUser: any,
    @Res() res: Response,
  ) {
    const result = await this.commandesService.findOne(reference, currentUser);
    if (!result.success || !result.data) {
      throw new NotFoundException(result.message ?? 'Commande introuvable');
    }

    const pdf = await this.invoiceService.buildInvoicePdf(result.data);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="facture-${reference}.pdf"`,
      'Content-Length': String(pdf.length),
    });
    res.end(pdf);
  }
  @UseGuards(AuthGuard)
  @Get('abonnements/by-user')
  findAbonnementsByUser(@CurrentUser() currentUser: any) {
    return this.abonnementsService.findByUser(currentUser);
  }

  @UseGuards(AuthGuard)
  @Get('abonnement/resilier/:id')
  resilierAbonnementByUser(
    @Param('id') id: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.abonnementsService.resilier(id, currentUser);
  }

  // Modifier un abonnement (quantité / période) — recalcul, sans paiement.
  @UseGuards(AuthGuard)
  @Patch('abonnement/:id')
  updateAbonnement(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() currentUser: any,
  ) {
    return this.abonnementsService.update(id, body, currentUser);
  }

  // Renouveler un abonnement — débit off-session de la carte enregistrée.
  @UseGuards(AuthGuard)
  @Post('abonnement/renouveler/:id')
  renouvelerAbonnement(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.abonnementsService.renouveler(id, currentUser);
  }

  // Finaliser un renouvellement après authentification 3-D Secure.
  @UseGuards(AuthGuard)
  @Post('abonnement/renouveler/:id/confirm')
  confirmRenouvellement(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() currentUser: any,
  ) {
    return this.abonnementsService.confirmRenouvellement(
      id,
      body?.paymentIntentId,
      currentUser,
    );
  }

  @UseGuards(AuthGuard)
  @Patch(':id')
  cancel(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.commandesService.cancel(id, currentUser);
  }

  // Changement de statut d'une commande par un administrateur.
  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @Patch(':id/statut')
  updateStatut(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() currentUser: any,
  ) {
    return this.commandesService.updateStatutByAdmin(
      id,
      body?.statut,
      currentUser,
    );
  }
}
