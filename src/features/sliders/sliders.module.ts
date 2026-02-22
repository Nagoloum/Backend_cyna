import { Module } from '@nestjs/common';
import { SlidersService } from './sliders.service';
import { SlidersController } from './sliders.controller';

@Module({
  controllers: [SlidersController],
  providers: [SlidersService],
})
export class SlidersModule {}
