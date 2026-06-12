import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { PushService } from './push.service';
import { PushController } from './push.controller';
import {
  PushSubscription,
  PushSubscriptionSchema,
} from './entities/push-subscription.entity';
import { UsersModule } from '../users/users.module';

// @Global : PushService est injectable partout sans réimport du module.
// Même pattern que AuditModule et AnalyticsModule.
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PushSubscription.name, schema: PushSubscriptionSchema },
    ]),
    UsersModule,
  ],
  controllers: [PushController],
  providers: [PushService, JwtService],
  exports: [PushService],
})
export class PushModule {}
