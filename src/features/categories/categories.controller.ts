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
  UseInterceptors,
  UploadedFiles,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AuthorizeRoles } from 'src/shared/decorators/authorize-roles.decorator';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { UserRoles } from 'src/shared/common/user-roles.enum';
import { AuthorizeGuard } from 'src/shared/guards/authorization.guard';
import { QueryDto } from 'src/shared/dto/query.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { FormDataTransformPipe } from 'src/shared/pipes/formdata-transform.pipe';
import { memoryStorage } from 'multer';

@ApiTags('Categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'newImage', maxCount: 1 }], {
      storage: memoryStorage(), // Le fichier n'est pas écrit sur le disque ici
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return cb(
            new BadRequestException('Format invalide, JPG, PNG ou WebP'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  @Post()
  create(
    @Body(FormDataTransformPipe, ValidationPipe)
    createCategoryDto: CreateCategoryDto,
    @UploadedFiles() files: { newImage?: Express.Multer.File[] },
  ) {
    return this.categoriesService.create(createCategoryDto, files);
  }

  // @AuthorizeRoles(UserRoles.ADMIN)
  // @UseGuards(AuthGuard, AuthorizeGuard)
  @Get()
  findAll(@Query() queryDto: QueryDto) {
    return this.categoriesService.findAll(queryDto);
  }

  @Get('category-by-order')
  categoryByOrder() {
    return this.categoriesService.categoryByOrder();
  }
  @Get('category-for-user/:slug')
  findCateroryBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findCateroryBySlug(slug);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.categoriesService.findOne(slug);
  }

  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'newImage', maxCount: 1 }], {
      storage: memoryStorage(), // Le fichier n'est pas écrit sur le disque ici
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return cb(new BadRequestException('Format invalide'), false);
        }
        cb(null, true);
      },
    }),
  )
  @Patch(':slug')
  update(
    @UploadedFiles()
    files: {
      newImage?: Express.Multer.File[];
    },
    @Param('slug') slug: string,
    @Body(FormDataTransformPipe, ValidationPipe)
    updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(slug, updateCategoryDto, files);
  }

  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @Delete(':slug')
  remove(@Param('slug') slug: string) {
    return this.categoriesService.remove(slug);
  }
}
