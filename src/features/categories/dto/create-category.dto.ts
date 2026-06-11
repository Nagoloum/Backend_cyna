import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsEmpty, IsNotEmpty, IsOptional, IsString } from 'class-validator';

@ApiSchema({ description: 'Data Transfer Object pour créer une catégorie' })
export class CreateCategoryDto {
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  @ApiProperty()
  name!: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Image uniquement (JPG, PNG, WebP), max 2Mo',
    required: true,
  })
  @IsOptional()
  newImage!: string;

  @ApiPropertyOptional()
  @IsOptional()
  description!: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'L’ordre est obligatoire' })
  order!: number;
}
