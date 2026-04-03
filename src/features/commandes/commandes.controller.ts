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
  Headers,
} from '@nestjs/common';
import { CommandesService } from './commandes.service';
import { CreateCommandeDto } from './dto/create-commande.dto';
import { UpdateCommandeDto } from './dto/update-commande.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthorizeRoles } from 'src/shared/decorators/authorize-roles.decorator';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { FormDataTransformPipe } from 'src/shared/pipes/formdata-transform.pipe';
import { CurrentUser } from 'src/shared/decorators/current-user.decorators';
import { QueryDto } from 'src/shared/dto/query.dto';
import { UserRoles } from 'src/shared/common/user-roles.enum';
import { AuthorizeGuard } from 'src/shared/guards/authorization.guard';
import { ApiResponse } from 'src/shared/responses/api-response';

@ApiTags('Commandes')
@ApiBearerAuth()
@Controller('commandes')
export class CommandesController {
  constructor(private readonly commandesService: CommandesService) {}

  @UseGuards(AuthGuard)
  @Post('create')
  createOrderWithStripe(
    @Body(FormDataTransformPipe, ValidationPipe)
    createCommandeDto: CreateCommandeDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.commandesService.createWithStripeCheckout(
      createCommandeDto,
      currentUser,
    );
  }

  @Get('payment/success')
  paymentSuccess(
    @Query('orderId') orderId?: string,
    @Query('session_id') sessionId?: string,
  ) {
    return this.commandesService.confirmPaymentSuccess(orderId, sessionId);
  }

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

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCommandeDto: UpdateCommandeDto,
  ) {
    return this.commandesService.update(+id, updateCommandeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.commandesService.remove(+id);
  }
}
