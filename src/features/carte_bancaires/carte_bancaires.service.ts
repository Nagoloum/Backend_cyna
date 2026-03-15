import { Injectable } from '@nestjs/common';
import { CreateCarteBancaireDto } from './dto/create-carte_bancaire.dto';
import { UpdateCarteBancaireDto } from './dto/update-carte_bancaire.dto';

@Injectable()
export class CarteBancairesService {
  create(createCarteBancaireDto: CreateCarteBancaireDto) {
    return 'This action adds a new carteBancaire';
  }

  findAll() {
    return `This action returns all carteBancaires`;
  }

  findOne(id: number) {
    return `This action returns a #${id} carteBancaire`;
  }

  update(id: number, updateCarteBancaireDto: UpdateCarteBancaireDto) {
    return `This action updates a #${id} carteBancaire`;
  }

  remove(id: number) {
    return `This action removes a #${id} carteBancaire`;
  }
}
