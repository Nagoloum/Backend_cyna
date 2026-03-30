import { PartialType } from '@nestjs/swagger';
import { CreateAbonnementDto } from './create-abonnement.dto';

export class UpdateAbonnementDto extends PartialType(CreateAbonnementDto) {}
