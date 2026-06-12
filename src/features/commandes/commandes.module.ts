import { Module } from '@nestjs/common';
import { CommandesService } from './commandes.service';
import { AbonnementsService } from './abonnements.service';
import { CommandesController } from './commandes.controller';
import { StripeWebhookController } from './stripe-webhook.controller';
import { CronController } from './cron.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Commande, CommandeSchema } from './entities/commande.entity';
import { JwtService } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { SharedService } from '../../shared/services/shared.service';
import { SendEmailService } from '../../shared/services/sendemail.service';
import { InvoiceService } from '../../shared/services/invoice.service';
import {
  CarteBancaire,
  CarteBancaireSchema,
} from '../carte_bancaires/entities/carte_bancaire.entity';
import { Product, ProductSchema } from '../products/entities/product.entity';
import { ServicesModule } from '../services/services.module';
import { ProductsModule } from '../products/products.module';
import { StripeModule } from '../../stripe/stripe.module';
import {
  AdresseFacturation,
  AdresseFacturationSchema,
} from '../adresse_facturations/entities/adresse_facturation.entity';
import { CarteBancairesModule } from '../carte_bancaires/carte_bancaires.module';
import { AdresseFacturationsModule } from '../adresse_facturations/adresse_facturations.module';
import { CouponsModule } from '../coupons/coupons.module';

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
    CarteBancairesModule,
    AdresseFacturationsModule,
    CouponsModule,
    StripeModule.forRootAsync(),
  ],
  controllers: [CommandesController, StripeWebhookController, CronController],
  providers: [
    CommandesService,
    AbonnementsService,
    JwtService,
    SharedService,
    SendEmailService,
    InvoiceService,
  ],
  exports: [MongooseModule],
})
export class CommandesModule {}
