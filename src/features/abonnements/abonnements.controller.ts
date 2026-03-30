import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { AbonnementsService } from './abonnements.service';
import { CreateAbonnementDto } from './dto/create-abonnement.dto';
import { UpdateAbonnementDto } from './dto/update-abonnement.dto';

@Controller('abonnements')
export class AbonnementsController {
  constructor(private readonly abonnementsService: AbonnementsService) {}

  @Get()
  findAll() {
    return this.abonnementsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.abonnementsService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAbonnementDto: UpdateAbonnementDto,
  ) {
    return this.abonnementsService.update(+id, updateAbonnementDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.abonnementsService.remove(+id);
  }
}
