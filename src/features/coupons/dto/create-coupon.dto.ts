import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CouponType } from '../entities/coupon.entity';

export class CreateCouponDto {
  @ApiProperty({ example: 'WELCOME10' })
  @IsNotEmpty({ message: 'Le code est obligatoire' })
  @IsString()
  code!: string;

  @ApiProperty({ enum: CouponType })
  @IsEnum(CouponType, { message: 'Type de coupon invalide (PERCENT ou FIXED)' })
  type!: CouponType;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Date de début (ISO)' })
  @IsOptional()
  @IsString()
  startsAt?: string;

  @ApiPropertyOptional({ description: 'Date de fin (ISO)' })
  @IsOptional()
  @IsString()
  endsAt?: string;

  @ApiPropertyOptional({ default: 0, description: '0 = illimité' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxUsage?: number;

  @ApiPropertyOptional({ default: 0, description: 'Montant HT minimum' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAmount?: number;
}
