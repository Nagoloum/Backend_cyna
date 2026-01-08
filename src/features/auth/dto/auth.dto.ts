import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

@ApiSchema({ description: 'Description of the RegisterDto schema' })
export class RegisterDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Email est obligatoire' })
  email: string;
  @ApiProperty()
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
  @ApiProperty()
  email: string;
  @ApiProperty()
  password: string;
}
