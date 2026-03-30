import { Module } from '@nestjs/common';
import { AbonnementsService } from './abonnements.service';
import { AbonnementsController } from './abonnements.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Abonnement, AbonnementSchema } from './entities/abonnement.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Abonnement.name, schema: AbonnementSchema },
    ]),
  ],
  controllers: [AbonnementsController],
  providers: [AbonnementsService],
  exports: [MongooseModule],
})
export class AbonnementsModule {}
