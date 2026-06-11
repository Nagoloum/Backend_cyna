import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ValidationPipe,
  UseInterceptors,
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { AuthorizeRoles } from '../../shared/decorators/authorize-roles.decorator';
import { UserRoles } from '../../shared/common/user-roles.enum';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { AuthorizeGuard } from '../../shared/guards/authorization.guard';
import { QueryDto } from '../../shared/dto/query.dto';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FormDataTransformPipe } from '../../shared/pipes/formdata-transform.pipe';
import { NoFilesInterceptor } from '@nestjs/platform-express';
@ApiTags('Services')
@ApiBearerAuth()
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(NoFilesInterceptor())
  @Post()
  create(
    @Body(FormDataTransformPipe, ValidationPipe)
    createServiceDto: CreateServiceDto,
  ) {
    return this.servicesService.create(createServiceDto);
  }

  @Get()
  findAll(@Query() queryDto: QueryDto) {
    return this.servicesService.findAll(queryDto);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.servicesService.findOne(slug);
  }

  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(NoFilesInterceptor())
  @Patch(':slug')
  update(
    @Param('slug') slug: string,
    @Body(FormDataTransformPipe, ValidationPipe)
    updateServiceDto: UpdateServiceDto,
  ) {
    return this.servicesService.update(slug, updateServiceDto);
  }

  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @Delete(':slug')
  remove(@Param('slug') slug: string) {
    return this.servicesService.remove(slug);
  }
}
