import { Test, TestingModule } from '@nestjs/testing';
import { CarteBancairesController } from './carte_bancaires.controller';
import { CarteBancairesService } from './carte_bancaires.service';

describe('CarteBancairesController', () => {
  let controller: CarteBancairesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CarteBancairesController],
      providers: [CarteBancairesService],
    }).compile();

    controller = module.get<CarteBancairesController>(CarteBancairesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
