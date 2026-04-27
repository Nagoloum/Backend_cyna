import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
export class CreateAdresseFacturationDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Nom est obligatoire' })
  firstName!: string;
  @ApiProperty()
  @IsNotEmpty({ message: 'Prénom est obligatoire' })
  lastName!: string;
  @ApiProperty()
  @IsNotEmpty({ message: 'adresse est obligatoire' })
  adresse!: string;
  @ApiPropertyOptional()
  complementAdresse!: string;
  @ApiProperty()
  @IsNotEmpty({ message: 'Ville est obligatoire' })
  city!: string;
  @ApiProperty()
  @IsNotEmpty({ message: 'Région est obligatoire' })
  region!: string;
  @ApiProperty()
  @IsNotEmpty({ message: 'Pays est obligatoire' })
  country!: string;
  @ApiProperty()
  @IsNotEmpty({ message: 'Code postal est obligatoire' })
  codePostal!: string;
  @ApiProperty()
  @IsNotEmpty({ message: 'Numéro de téléphone est obligatoire' })
  phone!: string;
  @ApiPropertyOptional()
  defaultAf!: boolean;
}
