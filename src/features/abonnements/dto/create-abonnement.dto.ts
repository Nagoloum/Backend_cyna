import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { PeriodeAbonnement } from 'src/shared/common/periode-abonnement.enum';
export class CreateAbonnementDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Date de fin est obligatoire' })
  dateFin: string;
  @ApiProperty()
  @IsNotEmpty({ message: 'Date de début est obligatoire' })
  dateDebut: string;
  @ApiProperty()
  @IsNotEmpty({ message: 'Quantité est obligatoire' })
  quantity: number;
  @ApiProperty()
  @IsNotEmpty({ message: 'Prix est obligatoire' })
  price: string;
  @ApiProperty({ enum: PeriodeAbonnement })
  @IsNotEmpty()
  @IsEnum(PeriodeAbonnement)
  periode: PeriodeAbonnement;
  @ApiProperty()
  @ApiProperty()
  @IsNotEmpty({ message: 'ID commande est obligatoire' })
  commandeId: string;
  @ApiProperty()
  @IsNotEmpty({ message: 'ID produit est obligatoire' })
  productId: string;
}
