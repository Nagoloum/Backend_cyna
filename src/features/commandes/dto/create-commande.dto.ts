import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { CreateAbonnementDto } from 'src/features/abonnements/dto/create-abonnement.dto';
import { StatutCommande } from 'src/shared/common/statut-commande.enum';

export class CreateCommandeDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Prix total est obligatoire' })
  totalPrice: string;
  @ApiProperty()
  @IsNotEmpty({ message: 'Nombre de produits est obligatoire' })
  nbreProducts: string;
  @ApiProperty({
    enum: StatutCommande,
    enumName: 'CommandeStatus',
    description: 'Statut de la commande',
  })
  @IsNotEmpty({ message: 'Statut est obligatoire' })
  statut: StatutCommande;
  @ApiProperty()
  @IsNotEmpty({ message: 'ID carte bancaire est obligatoire' })
  cbId: string;
  @ApiProperty({
    type: () => CreateAbonnementDto,
    isArray: true,
    description: 'Liste des abonnements',
  })
  @IsNotEmpty({ message: 'ID abonnement est obligatoire' })
  @ValidateNested({ each: true })
  @Type(() => CreateAbonnementDto)
  abonnements: CreateAbonnementDto[];
}
