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
import { AdresseFacturationsService } from './adresse_facturations.service';
import { CreateAdresseFacturationDto } from './dto/create-adresse_facturation.dto';
import { UpdateAdresseFacturationDto } from './dto/update-adresse_facturation.dto';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { NoFilesInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { FormDataTransformPipe } from 'src/shared/pipes/formdata-transform.pipe';
import { CurrentUser } from 'src/shared/decorators/current-user.decorators';
@ApiTags('Adresse Facturations')
@ApiBearerAuth()
@Controller('adresse-facturations')
export class AdresseFacturationsController {
  constructor(
    private readonly adresseFacturationsService: AdresseFacturationsService,
  ) {}

  @UseGuards(AuthGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(NoFilesInterceptor())
  @Post()
  create(
    @Body(FormDataTransformPipe, ValidationPipe)
    createAdresseFacturationDto: CreateAdresseFacturationDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.adresseFacturationsService.create(
      createAdresseFacturationDto,
      currentUser,
    );
  }

  @UseGuards(AuthGuard)
  @Get('by-user')
  findByUser(@CurrentUser() currentUser: any) {
    return this.adresseFacturationsService.findByUser(currentUser);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adresseFacturationsService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAdresseFacturationDto: UpdateAdresseFacturationDto,
  ) {
    return this.adresseFacturationsService.update(
      +id,
      updateAdresseFacturationDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.adresseFacturationsService.remove(+id);
  }
}
