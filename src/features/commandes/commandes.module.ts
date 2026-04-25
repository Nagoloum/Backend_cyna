import { Module } from '@nestjs/common';
import { CommandesService } from './commandes.service';
import { CommandesController } from './commandes.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Commande, CommandeSchema } from './entities/commande.entity';
import { JwtService } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { SharedService } from 'src/shared/services/shared.service';
import {
  CarteBancaire,
  CarteBancaireSchema,
} from '../carte_bancaires/entities/carte_bancaire.entity';
import { Product, ProductSchema } from '../products/entities/product.entity';
import { ServicesModule } from '../services/services.module';
import { ProductsModule } from '../products/products.module';
import { StripeModule } from 'src/stripe/stripe.module';
import {
  AdresseFacturation,
  AdresseFacturationSchema,
} from '../adresse_facturations/entities/adresse_facturation.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Commande.name, schema: CommandeSchema },
      { name: Product.name, schema: ProductSchema },
      { name: CarteBancaire.name, schema: CarteBancaireSchema },
      { name: AdresseFacturation.name, schema: AdresseFacturationSchema },
    ]),
    ServicesModule,
    UsersModule,
    ProductsModule,
    StripeModule.forRootAsync(),
  ],
  controllers: [CommandesController],
  providers: [CommandesService, JwtService, SharedService],
  exports: [MongooseModule],
})
export class CommandesModule {}
