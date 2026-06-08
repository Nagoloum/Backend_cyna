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
  BadRequestException,
  ValidationPipe,
  UploadedFiles,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AuthorizeRoles } from 'src/shared/decorators/authorize-roles.decorator';
import { UserRoles } from 'src/shared/common/user-roles.enum';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { AuthorizeGuard } from 'src/shared/guards/authorization.guard';
import { QueryDto } from 'src/shared/dto/query.dto';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FormDataTransformPipe } from 'src/shared/pipes/formdata-transform.pipe';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @ApiConsumes('multipart/form-data')
  // 'images' est le nom du champ, 10 est le nombre maximum de fichiers
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return cb(new BadRequestException('Format non supporté'), false);
        }
        cb(null, true);
      },
    }),
  )
  @Post()
  create(
    @Body(FormDataTransformPipe, ValidationPipe)
    createProductDto: CreateProductDto,
    @UploadedFiles() files: Express.Multer.File[], // Note le pluriel ici
  ) {
    // files contiendra un tableau de tes images
    return this.productsService.create(createProductDto, files);
  }
  @Get('similar/:categoryId')
  productSimilar(@Param('categoryId') categoryId: string) {
    return this.productsService.productSimilar(categoryId);
  }
  @Get()
  findAll(@Query() queryDto: QueryDto) {
    return this.productsService.findAll(queryDto);
  }

  @Get('product-by-order')
  productByOrder() {
    return this.productsService.productByOrder();
  }
  // Permet de récupérer un produit par son slug, accessible à tous les utilisateurs

  @Get('findBySlug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  // Permet de récupérer un produit par son slug, accessible uniquement aux admins
  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.productsService.findOne(slug);
  }

  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return cb(new BadRequestException('Format non supporté'), false);
        }
        cb(null, true);
      },
    }),
  )
  @Patch(':slug')
  update(
    @Param('slug') slug: string,
    @Body(FormDataTransformPipe, ValidationPipe)
    updateProductDto: UpdateProductDto,
    @UploadedFiles() files: Express.Multer.File[], // Note le pluriel ici
  ) {
    return this.productsService.update(slug, updateProductDto, files);
  }

  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @Delete(':slug')
  remove(@Param('slug') slug: string) {
    return this.productsService.remove(slug);
  }
}
