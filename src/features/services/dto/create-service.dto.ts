import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

@ApiSchema({ description: 'Data Transfer Object pour créer un service' })
export class CreateServiceDto {
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  TechFile: string;

  @ApiPropertyOptional()
  @IsOptional()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  available: boolean;

  @ApiProperty()
  @IsNotEmpty({ message: "L'ID de la categorie est obligatoire" })
  categoryId: string;
}
