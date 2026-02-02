import { ApiProperty, ApiSchema } from '@nestjs/swagger';
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
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Le slug du produit est obligatoire' })
  slug: string;

  @ApiProperty({ type: [ImageDto] })
  @ValidateNested({ each: true })
  @Type(() => ImageDto)
  images: ImageDto[];

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  priceMonth: number;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  priceYear: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  stock?: number;

  @IsBoolean()
  @IsOptional()
  is_selected?: boolean;

  @IsBoolean()
  @IsOptional()
  priority?: boolean;
}
