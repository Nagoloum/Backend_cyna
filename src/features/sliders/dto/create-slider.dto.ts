import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSliderDto {
    @IsString({ message: 'Le titre est obligatoire' })
    @IsNotEmpty()
    @ApiProperty({ description: 'Titre affiché sur le carrousel' })
    title: string;

    @ApiProperty({
        type: 'string',
        format: 'binary',
        description: 'Image uniquement (JPG, PNG, WebP), max 2Mo',
        required: true,
    })
    newImage: string;

    @IsString()
    @IsNotEmpty({ message: 'Le lien de redirection est obligatoire' })
    @ApiProperty({ description: 'URL du lien promotionnel (ex: /categories)' })
    linkUrl: string;

    @IsString()
    @IsNotEmpty({ message: 'Le libellé du bouton est obligatoire' })
    @ApiProperty({ description: 'Libellé affiché sur le bouton du carrousel' })
    NameUrl: string;

    @IsOptional()
    @ApiPropertyOptional({ default: 0, description: 'Position d’affichage' })
    order: number;
}