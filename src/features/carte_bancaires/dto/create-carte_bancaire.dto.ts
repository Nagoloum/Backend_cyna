import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class CreateCarteBancaireDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Nom de la carte est obligatoire' })
  carteName!: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Numéro de carte est obligatoire' })
  carteNumber!: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Date de carte est obligatoire' })
  carteDate!: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'CVV de carte est obligatoire' })
  carteCVV!: string;
  @ApiPropertyOptional()
  defaultCb!: boolean;
}
