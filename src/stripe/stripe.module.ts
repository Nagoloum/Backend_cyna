import { DynamicModule, Module } from '@nestjs/common';
import { StripeService } from 'src/shared/services/stripe.service';

@Module({})
export class StripeModule {
  static forRootAsync(): DynamicModule {
    return {
      module: StripeModule,
      providers: [StripeService],
      exports: [StripeService],
    };
  }
}
