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
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { AuthorizeRoles } from 'src/shared/decorators/authorize-roles.decorator';
import { UserRoles } from 'src/shared/common/user-roles.enum';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { AuthorizeGuard } from 'src/shared/guards/authorization.guard';
import { QueryDto } from 'src/shared/dto/query.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
@ApiTags('Services')
@ApiBearerAuth()
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @Post()
  create(@Body() createServiceDto: CreateServiceDto) {
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
  @Patch(':slug')
  update(
    @Param('slug') slug: string,
    @Body() updateServiceDto: UpdateServiceDto,
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
