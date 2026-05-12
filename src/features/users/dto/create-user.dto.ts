import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class CreateUserDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Email est obligatoire' })
  email!: string;
  @ApiProperty()
  @ApiProperty()
  @IsNotEmpty({ message: 'Prénom est obligatoire' })
  firstName!: string;
  @ApiProperty()
  @IsNotEmpty({ message: 'Nom est obligatoire' })
  lastName!: string;
}

export class ChangePasswordProfilDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Mot de passe est obligatoire' })
  currentPassword!: string;
  @ApiProperty()
  @IsNotEmpty({ message: 'Nouveau mot de passe est obligatoire' })
  newPassword!: string;
  @ApiProperty()
  @IsNotEmpty({ message: 'Confirmer le nouveau mot de passe est obligatoire' })
  confirmPassword!: string;
}
