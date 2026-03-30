import { PartialType } from '@nestjs/swagger';
import { CreateAdresseFacturationDto } from './create-adresse_facturation.dto';

export class UpdateAdresseFacturationDto extends PartialType(CreateAdresseFacturationDto) {}
