import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsString } from 'class-validator';

@ApiSchema({ description: 'Data Transfer Object pour créer un service' })
export class CreateServiceDto {
  @IsString({ message: 'Le nom est obligatoire' })
  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  TechFile: string;

  @ApiPropertyOptional()
  description: string;

  @ApiPropertyOptional()
  available: boolean;

  @ApiProperty()
  categoryId: string;
}
