import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { StatutCommande } from 'src/shared/common/statut-commande.enum';
import { AbonnementDto } from '../../../shared/dto';

export class CreateCommandeDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'ID carte bancaire est obligatoire' })
  @IsMongoId({ message: "L'ID carte bancaire doit être un ObjectId valide" })
  cbId!: string;
  @ApiProperty()
  @IsNotEmpty({ message: 'ID adresse de facturation est obligatoire' })
  @IsMongoId({
    message: "L'ID adresse de facturation doit être un ObjectId valide",
  })
  adresseFacturationId!: string;

  @ApiProperty({ type: [AbonnementDto] })
  @IsNotEmpty({ message: 'Les abonnements sont obligatoires' })
  @ArrayMinSize(1, {
    message: 'Une commande doit contenir au moins un abonnement',
  })
  @ValidateNested({ each: true })
  @Type(() => AbonnementDto)
  abonnements!: AbonnementDto[];
}
