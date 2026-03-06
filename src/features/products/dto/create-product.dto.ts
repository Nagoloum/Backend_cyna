import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsMongoId,
} from 'class-validator';

@ApiSchema({ description: 'Data Transfer Object pour créer un produit' })
export class CreateProductDto {
  @IsMongoId({ message: 'L’ID du service doit être un ID MongoDB valide' })
  @ApiProperty()
  serviceId: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom du produit est obligatoire' })
  @ApiProperty()
  name: string;

  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Sélectionnez plusieurs images pour le produit',
    required: false, // Informe Swagger que ce n'est pas bloquant côté Body
  })
  @IsOptional() // Empêche l'erreur si le champ est vide dans le Body
  images?: any;

  @IsNotEmpty()
  @ApiProperty()
  priceMonth: number;

  @IsNotEmpty()
  @ApiProperty()
  priceYear: number;

  @IsOptional() // Permet de passer si le champ est vide dans Swagger
  @ApiProperty()
  stock: number;

  @IsOptional() // Très important pour le multipart
  @ApiPropertyOptional()
  is_selected: boolean;

  @IsOptional()
  @ApiPropertyOptional()
  priority: boolean;
}
