import { Module } from '@nestjs/common';
import { AdresseFacturationsService } from './adresse_facturations.service';
import { AdresseFacturationsController } from './adresse_facturations.controller';
import {
  AdresseFacturation,
  AdresseFacturationSchema,
} from './entities/adresse_facturation.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: AdresseFacturation.name,
        schema: AdresseFacturationSchema,
      },
    ]),
    UsersModule,
  ],
  controllers: [AdresseFacturationsController],
  providers: [AdresseFacturationsService, JwtService],
})
export class AdresseFacturationsModule {}
