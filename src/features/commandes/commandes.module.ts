import { Module } from '@nestjs/common';
import { CommandesService } from './commandes.service';
import { CommandesController } from './commandes.controller';
import { Mongoose } from 'mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { Commande, CommandeSchema } from './entities/commande.entity';
import { Abonnement } from '../abonnements/entities/abonnement.entity';
import { AbonnementsModule } from '../abonnements/abonnements.module';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { UsersModule } from '../users/users.module';
import { SharedService } from 'src/shared/services/shared.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Commande.name, schema: CommandeSchema },
    ]),
    AbonnementsModule,
    UsersModule,
  ],
  controllers: [CommandesController],
  providers: [CommandesService, JwtService, SharedService],
  exports: [MongooseModule],
})
export class CommandesModule {}
