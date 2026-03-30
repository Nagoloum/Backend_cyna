import { Test, TestingModule } from '@nestjs/testing';
import { CarteBancairesService } from './carte_bancaires.service';

describe('CarteBancairesService', () => {
  let service: CarteBancairesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CarteBancairesService],
    }).compile();

    service = module.get<CarteBancairesService>(CarteBancairesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
