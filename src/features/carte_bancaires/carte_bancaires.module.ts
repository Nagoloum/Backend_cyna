import { Module } from '@nestjs/common';
import { CarteBancairesService } from './carte_bancaires.service';
import { CarteBancairesController } from './carte_bancaires.controller';
import {
  CarteBancaire,
  CarteBancaireSchema,
} from './entities/carte_bancaire.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: CarteBancaire.name,
        schema: CarteBancaireSchema,
      },
    ]),
    UsersModule,
  ],
  controllers: [CarteBancairesController],
  providers: [CarteBancairesService, JwtService],
})
export class CarteBancairesModule {}
