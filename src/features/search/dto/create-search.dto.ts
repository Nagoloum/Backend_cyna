import { IsOptional, IsString, IsNumber, IsBoolean, IsArray, IsEnum, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSearchDto {
    @ApiPropertyOptional({
        description: 'Recherche par nom de produit ou contenu de description',
        example: 'Cybersecurity'
    })
    @IsOptional()
    @IsString()
    text?: string;

    @ApiPropertyOptional({
        type: [String],
        isArray: true, // Correction : Pour un meilleur affichage Swagger
        description: 'Liste des IDs de catégories (ex: Opérations, Détection)'
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    categories?: string[];

    @ApiPropertyOptional({
        type: [String],
        isArray: true, // Correction : Pour un meilleur affichage Swagger
        description: 'Liste des IDs de services techniques (EDR, SOC, XDR)'
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    services?: string[];

    @ApiPropertyOptional({ description: 'Budget mensuel minimum', minimum: 0 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    minPrice?: number;

    @ApiPropertyOptional({ description: 'Budget mensuel maximum', minimum: 0 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    maxPrice?: number;

    @ApiPropertyOptional({
        description: 'Masquer les services en maintenance ou épuisés',
        type: Boolean,
        default: false
    })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true) // Sécurité pour URL
    @IsBoolean()
    onlyAvailable?: boolean;

    @ApiPropertyOptional({
        enum: ['prix', 'nouveauté', 'disponibilité'],
        description: 'Critère de tri principal'
    })
    @IsOptional()
    @IsEnum(['prix', 'nouveauté', 'disponibilité'])
    sortBy?: 'prix' | 'nouveauté' | 'disponibilité';

    @ApiPropertyOptional({
        enum: ['asc', 'desc'],
        default: 'asc',
        description: 'Ordre croissant ou décroissant'
    })
    @IsOptional()
    @IsEnum(['asc', 'desc'])
    sortOrder?: 'asc' | 'desc' = 'asc';
}