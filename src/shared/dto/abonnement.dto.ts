import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  Min,
} from 'class-validator';
import { PeriodeAbonnement } from 'src/shared/common/periode-abonnement.enum';
export class AbonnementDto {
  @ApiProperty({ required: false })
  @IsOptional()
  dateFin: string;

  @ApiProperty({ required: false })
  @IsOptional()
  dateDebut: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Quantité est obligatoire' })
  @Min(1, { message: 'La quantité doit être supérieure à 0' })
  quantity: number;

  @ApiProperty({ required: false })
  @IsOptional()
  price: string;

  @ApiProperty({ enum: PeriodeAbonnement })
  @IsNotEmpty()
  @IsEnum(PeriodeAbonnement)
  periode: PeriodeAbonnement;

  @ApiProperty()
  @IsNotEmpty({ message: 'ID produit est obligatoire' })
  @IsMongoId({ message: "L'ID produit doit être un ObjectId valide" })
  productId: string;
}
