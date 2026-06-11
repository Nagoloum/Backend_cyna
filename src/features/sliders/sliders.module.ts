import { Module } from '@nestjs/common';
import { SlidersService } from './sliders.service';
import { SlidersController } from './sliders.controller';
import { Slider, SliderSchema } from './entities/slider.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { JwtService } from '@nestjs/jwt';
import { CloudinaryService } from 'src/shared/services/cloudinary.service';
@Module({
  imports: [
    // Indispensable pour que @InjectModel(Slider.name) fonctionne dans ton Service
    MongooseModule.forFeature([{ name: Slider.name, schema: SliderSchema }]),UsersModule
  ],
  controllers: [SlidersController],
  providers: [SlidersService, JwtService, CloudinaryService],
})
export class SlidersModule {}
