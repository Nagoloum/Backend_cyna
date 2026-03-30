import { Test, TestingModule } from '@nestjs/testing';
import { AbonnementsService } from './abonnements.service';

describe('AbonnementsService', () => {
  let service: AbonnementsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AbonnementsService],
    }).compile();

    service = module.get<AbonnementsService>(AbonnementsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
