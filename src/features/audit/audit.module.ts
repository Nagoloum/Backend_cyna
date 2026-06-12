import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditLog, AuditLogSchema } from './entities/audit-log.entity';
import { UsersModule } from '../users/users.module';

// Module global : AuditService est injectable partout (auth, users, commandes…)
// sans réimport. Importe UsersModule + JwtService pour les guards du contrôleur
// de consultation. UsersModule n'importe PAS ce module (il consomme le provider
// global) : aucune dépendance circulaire.
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
    UsersModule,
  ],
  controllers: [AuditController],
  providers: [AuditService, JwtService],
  exports: [AuditService],
})
export class AuditModule {}
