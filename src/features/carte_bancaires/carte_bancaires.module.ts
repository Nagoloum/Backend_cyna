import { Module } from '@nestjs/common';
import { CarteBancairesService } from './carte_bancaires.service';
import { CarteBancairesController } from './carte_bancaires.controller';

@Module({
  controllers: [CarteBancairesController],
  providers: [CarteBancairesService],
})
export class CarteBancairesModule {}
