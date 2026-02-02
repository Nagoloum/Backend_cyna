import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ImageDto {
  @ApiProperty()
  @IsString({
    message: 'url est obligatoire',
  })
  url: string;
}
