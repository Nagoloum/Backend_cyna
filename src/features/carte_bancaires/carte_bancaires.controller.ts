import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CarteBancairesService } from './carte_bancaires.service';
import { CreateCarteBancaireDto } from './dto/create-carte_bancaire.dto';
import { UpdateCarteBancaireDto } from './dto/update-carte_bancaire.dto';

@Controller('carte-bancaires')
export class CarteBancairesController {
  constructor(private readonly carteBancairesService: CarteBancairesService) {}

  @Post()
  create(@Body() createCarteBancaireDto: CreateCarteBancaireDto) {
    return this.carteBancairesService.create(createCarteBancaireDto);
  }

  @Get()
  findAll() {
    return this.carteBancairesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.carteBancairesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCarteBancaireDto: UpdateCarteBancaireDto) {
    return this.carteBancairesService.update(+id, updateCarteBancaireDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.carteBancairesService.remove(+id);
  }
}
