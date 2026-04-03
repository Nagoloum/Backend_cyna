import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
export class CreateContactDto {
    @ApiProperty()
    @IsEmail({}, { message: 'L’adresse e-mail doit être valide.' })
    @IsNotEmpty({ message: 'L’e-mail est obligatoire.' })
    email: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty({ message: 'Le sujet est obligatoire.' })
    subject: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty({ message: 'Le message ne peut pas être vide.' })
    message: string;
}
