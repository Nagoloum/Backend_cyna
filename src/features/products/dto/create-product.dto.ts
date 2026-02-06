import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsMongoId,
  Min,
  ValidateNested,
} from 'class-validator';
import { ImageDto } from 'src/shared/dto';

@ApiSchema({ description: 'Data Transfer Object pour créer un produit' })
export class CreateProductDto {
  @IsMongoId({ message: 'L’ID du service doit être un ID MongoDB valide' })
  @ApiProperty()
  serviceId: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom du produit est obligatoire' })
  @ApiProperty()
  name: string;

  @ApiProperty({ type: [ImageDto] })
  @ValidateNested({ each: true })
  @Type(() => ImageDto)
  images: ImageDto[];

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  @ApiProperty()
  priceMonth: number;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  @ApiProperty()
  priceYear: number;

  @IsNumber()
  @Min(0)
  @ApiProperty()
  stock?: number;

  @IsBoolean()
  @ApiPropertyOptional()
  is_selected?: boolean;

  @IsBoolean()
  @ApiPropertyOptional()
  priority?: boolean;
}
