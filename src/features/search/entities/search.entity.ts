import { IsOptional, IsString, IsNumber, IsBoolean, IsArray, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class Search {
    @IsOptional()
    @IsString()
    text?: string; // Point 1 & 2 : Texte du titre et de la description

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    categories?: string[]; // Point 5 : Catégories (ex: "OPÉRATIONS")

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    services?: string[]; // Point 3 : Caractéristiques techniques (ex: "EDR", "SOC")

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    minPrice?: number; // Point 4 : Prix min

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    maxPrice?: number; // Point 4 : Prix max

    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    onlyAvailable?: boolean; // Point 6 : Filtrer les services indisponibles

    @IsOptional()
    @IsEnum(['prix', 'nouveauté', 'disponibilité'])
    sortBy?: 'prix' | 'nouveauté' | 'disponibilité'; // Tri Section VIII

    @IsOptional()
    @IsEnum(['asc', 'desc'])
    sortOrder?: 'asc' | 'desc' = 'asc';
}
