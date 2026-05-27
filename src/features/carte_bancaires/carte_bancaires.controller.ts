import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { CarteBancairesService } from './carte_bancaires.service';
import { CreateCarteBancaireDto } from './dto/create-carte_bancaire.dto';
import { UpdateCarteBancaireDto } from './dto/update-carte_bancaire.dto';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { NoFilesInterceptor } from '@nestjs/platform-express';
import { FormDataTransformPipe } from 'src/shared/pipes/formdata-transform.pipe';
import { CurrentUser } from 'src/shared/decorators/current-user.decorators';
@ApiTags('Carte Bancaires')
@ApiBearerAuth()
@Controller('carte-bancaires')
export class CarteBancairesController {
  constructor(private readonly carteBancairesService: CarteBancairesService) {}

  @UseGuards(AuthGuard)
  @Post('setup-intent')
  createSetupIntent(@CurrentUser() currentUser: any) {
    return this.carteBancairesService.createSetupIntent(currentUser);
  }

  @UseGuards(AuthGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(NoFilesInterceptor())
  @Post()
  create(
    @Body(FormDataTransformPipe, ValidationPipe)
    createCarteBancaireDto: CreateCarteBancaireDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.carteBancairesService.create(
      createCarteBancaireDto,
      currentUser,
    );
  }

  @UseGuards(AuthGuard)
  @Get('by-user')
  findByUser(@CurrentUser() currentUser: any) {
    return this.carteBancairesService.findByUser(currentUser);
  }
  @UseGuards(AuthGuard)
  @Get('defaut/:id')
  findDefault(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.carteBancairesService.findDefault(id, currentUser);
  }
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.carteBancairesService.findOne(id, currentUser);
  }

  @UseGuards(AuthGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(NoFilesInterceptor())
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(FormDataTransformPipe, ValidationPipe)
    updateCarteBancaireDto: UpdateCarteBancaireDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.carteBancairesService.update(
      id,
      updateCarteBancaireDto,
      currentUser,
    );
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.carteBancairesService.remove(id, currentUser);
  }
}
