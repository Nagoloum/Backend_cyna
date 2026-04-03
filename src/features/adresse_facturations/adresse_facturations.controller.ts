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
  Query,
} from '@nestjs/common';
import { AdresseFacturationsService } from './adresse_facturations.service';
import { CreateAdresseFacturationDto } from './dto/create-adresse_facturation.dto';
import { UpdateAdresseFacturationDto } from './dto/update-adresse_facturation.dto';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { NoFilesInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { FormDataTransformPipe } from 'src/shared/pipes/formdata-transform.pipe';
import { CurrentUser } from 'src/shared/decorators/current-user.decorators';
import { AuthorizeRoles } from 'src/shared/decorators/authorize-roles.decorator';
import { UserRoles } from 'src/shared/common/user-roles.enum';
import { AuthorizeGuard } from 'src/shared/guards/authorization.guard';
import { QueryDto } from 'src/shared/dto/query.dto';
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
  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @Get()
  findAll(@Query() queryDto: QueryDto) {
    return this.adresseFacturationsService.findAll(queryDto);
  }

  @UseGuards(AuthGuard)
  @Get('by-user')
  findByUser(@CurrentUser() currentUser: any) {
    return this.adresseFacturationsService.findByUser(currentUser);
  }

  @UseGuards(AuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.adresseFacturationsService.findOne(id, currentUser);
  }

  @UseGuards(AuthGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(NoFilesInterceptor())
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(FormDataTransformPipe, ValidationPipe)
    updateAdresseFacturationDto: UpdateAdresseFacturationDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.adresseFacturationsService.update(
      id,
      updateAdresseFacturationDto,
      currentUser,
    );
  }
  @UseGuards(AuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.adresseFacturationsService.remove(id, currentUser);
  }
}
