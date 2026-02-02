import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator/types/decorator/decorators";

export class CreateUserDto {
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
