import { forwardRef, Module } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { Service, ServiceSchema } from './entities/service.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { CategoriesModule } from '../categories/categories.module';
import { SharedService } from 'src/shared/services/shared.service';
import { JwtService } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Service.name, schema: ServiceSchema }]),
    forwardRef(() => CategoriesModule),
    UsersModule,
  ],
  controllers: [ServicesController],
  providers: [ServicesService, SharedService, JwtService],
  exports: [ServicesService, MongooseModule],
})
export class ServicesModule {}
