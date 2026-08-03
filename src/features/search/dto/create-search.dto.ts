import { IsOptional, IsString, IsNumber, IsBoolean, IsArray, IsEnum, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSearchDto {
    @ApiPropertyOptional({ description: 'Recherche textuelle', example: 'Cyber' })
    @IsOptional()
    @IsString()
    text?: string;
    @ApiPropertyOptional()
    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @IsString({ each: true })
    categories?: string[]; // Ce sont des IDs ici

    @ApiPropertyOptional()
    @IsOptional()
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    @IsArray()
    @IsString({ each: true })
    services?: string[]; // Ce sont des IDs ici

    @ApiPropertyOptional({ minimum: 0 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    minPrice?: number;

    @ApiPropertyOptional({ minimum: 0 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    maxPrice?: number;

    @ApiPropertyOptional({
        enum: ['prix', 'nouveauté', 'disponibilité'],
        description: 'Critère de tri',
        type: String // On force explicitement le type String ici pour Swagger
    })
    @IsOptional()
    @IsEnum(['prix', 'nouveauté', 'disponibilité'])
    sortBy?: 'prix' | 'nouveauté' | 'disponibilité';

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
    @IsOptional()
    @IsEnum(['asc', 'desc'])
    sortOrder?: 'asc' | 'desc' = 'asc';

    @ApiPropertyOptional({ minimum: 1, default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ minimum: 1, default: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    limit?: number = 10;
}