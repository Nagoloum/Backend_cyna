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
  BadRequestException,
  UploadedFiles,
  ValidationPipe,
  Query,
} from '@nestjs/common';
import { SlidersService } from './sliders.service';
import { CreateSliderDto } from './dto/create-slider.dto';
import { UpdateSliderDto } from './dto/update-slider.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UserRoles } from '../../shared/common/user-roles.enum';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { AuthorizeGuard } from '../../shared/guards/authorization.guard';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AuthorizeRoles } from '../../shared/decorators/authorize-roles.decorator';
import { FormDataTransformPipe } from '../../shared/pipes/formdata-transform.pipe';

@ApiTags('sliders')
@ApiBearerAuth()
@Controller('sliders')
export class SlidersController {
  constructor(private readonly slidersService: SlidersService) {}
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
  @Post()
  create(
    @Body(FormDataTransformPipe, ValidationPipe)
    createSliderDto: CreateSliderDto,
    @UploadedFiles() files: { newImage?: Express.Multer.File[] },
  ) {
    return this.slidersService.create(createSliderDto, files);
  }
  @Get()
  findAll() {
    return this.slidersService.findAll();
  }
  @Get('sliderTop')
  async findTop(@Query('limit') limit: string) {
    // On transforme le texte reçu en nombre.
    // Si 'limit' n'est pas envoyé, on passe undefined et le service prendra 3 par défaut.
    const topeSliders = limit ? parseInt(limit, 10) : 3;
    return this.slidersService.findTopSliders(topeSliders);
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
  @Patch(':idSlider')
  update(
    @UploadedFiles()
    files: {
      newImage?: Express.Multer.File[];
    },
    @Param('idSlider') slug: string,
    @Body(FormDataTransformPipe, ValidationPipe)
    updateSliderDto: UpdateSliderDto,
  ) {
    return this.slidersService.update(slug, updateSliderDto, files);
  }

  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @Delete(':idSlider')
  remove(@Param('idSlider') idSlider: string) {
    return this.slidersService.remove(idSlider);
  }
}
