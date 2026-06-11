import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

@ApiSchema({ description: 'Description of the RegisterDto schema' })
export class RegisterDto {
  @ApiProperty()
  @IsEmail({}, { message: "L'adresse e-mail doit être valide" })
  @IsNotEmpty({ message: 'Email est obligatoire' })
  email: string;
  @ApiProperty()
  @MinLength(6, {
    message: 'Le mot de passe doit contenir au moins 6 caractères',
  })
  @IsNotEmpty({ message: 'Mot de passe est obligatoire' })
  password: string;
  @ApiProperty()
  @IsNotEmpty({ message: 'Prénom est obligatoire' })
  firstName: string;
  @ApiProperty()
  @IsNotEmpty({ message: 'Nom est obligatoire' })
  lastName: string;
}
@ApiSchema({ description: 'Description of the LoginDto schema' })
export class LoginDto {
  // Décorateurs requis : avec ValidationPipe({ whitelist: true }), un champ
  // sans métadonnée de validation serait supprimé du body.
  @ApiProperty()
  @IsEmail({}, { message: "L'adresse e-mail doit être valide" })
  @IsNotEmpty({ message: 'Email est obligatoire' })
  email: string;
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Mot de passe est obligatoire' })
  password: string;
}
