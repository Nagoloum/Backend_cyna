import { PartialType } from '@nestjs/swagger';
import { CreateCarteBancaireDto } from './create-carte_bancaire.dto';

export class UpdateCarteBancaireDto extends PartialType(
  CreateCarteBancaireDto,
) {}
