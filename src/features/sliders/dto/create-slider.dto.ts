import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional, IsUrl } from 'class-validator';

export class CreateSliderDto {
    @IsString({ message: 'Le titre est obligatoire' })
    @IsNotEmpty()
    @ApiProperty({ description: 'Titre affiché sur le carrousel' })
    title: string;

    @IsString()
    @IsNotEmpty({ message: "L'image est obligatoire pour une section de carrousel" })
    @ApiProperty({ description: "URL ou nom du fichier image" })
    image: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ description: 'URL du lien promotionnel (ex: /boutique/promo)' })
    linkUrl: string;

    @IsString()
    @IsNotEmpty({ message: "L'image est obligatoire pour une section de carrousel" })
    @ApiProperty({ description: "URL ou nom du fichier image" })
    NameUrl: string;

    @IsNumber()
    @IsOptional()
    @ApiPropertyOptional({ default: 0, description: 'Position d’affichage' })
    order: number;
}