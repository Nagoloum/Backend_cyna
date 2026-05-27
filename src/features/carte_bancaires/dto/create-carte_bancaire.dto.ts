import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCarteBancaireDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Nom de la carte est obligatoire' })
  carteName!: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  carteNumber?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  carteDate?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  carteCVV?: string;
  @ApiPropertyOptional()
  isDefault!: boolean;

  @ApiPropertyOptional()
  @IsNotEmpty({ message: 'PaymentMethod Stripe est obligatoire' })
  @IsString()
  stripePaymentMethodId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stripeCustomerId?: string;
}
