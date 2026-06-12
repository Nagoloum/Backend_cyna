import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AbonnementDto } from '../../../shared/dto';

// Achat invité : email + identité + adresse de facturation inline + moyen de
// paiement Stripe (PaymentMethod créé côté client) + abonnements. Le backend
// crée un compte pour cet email, rattache la commande, et envoie un email pour
// définir le mot de passe.
export class GuestCheckoutDto {
  @ApiProperty()
  @IsEmail({}, { message: 'Email invalide' })
  email!: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Le prénom est obligatoire' })
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  @IsString()
  lastName!: string;

  @ApiProperty()
  @IsNotEmpty({ message: "L'adresse est obligatoire" })
  @IsString()
  adresse!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  complementAdresse?: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'La ville est obligatoire' })
  @IsString()
  city!: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'La région est obligatoire' })
  @IsString()
  region!: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Le pays est obligatoire' })
  @IsString()
  country!: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Le code postal est obligatoire' })
  @IsString()
  codePostal!: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Le téléphone est obligatoire' })
  @IsString()
  phone!: string;

  @ApiProperty({ description: 'Stripe PaymentMethod id (pm_...)' })
  @IsNotEmpty({ message: 'Le moyen de paiement est obligatoire' })
  @IsString()
  stripePaymentMethodId!: string;

  @ApiProperty({ type: [AbonnementDto] })
  @IsNotEmpty({ message: 'Les abonnements sont obligatoires' })
  @ArrayMinSize(1, {
    message: 'Une commande doit contenir au moins un abonnement',
  })
  @ValidateNested({ each: true })
  @Type(() => AbonnementDto)
  abonnements!: AbonnementDto[];

  @ApiProperty({ required: false, description: 'Code promo optionnel' })
  @IsOptional()
  @IsString()
  couponCode?: string;
}
