import { Test, TestingModule } from '@nestjs/testing';
import { AdresseFacturationsService } from './adresse_facturations.service';

describe('AdresseFacturationsService', () => {
  let service: AdresseFacturationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdresseFacturationsService],
    }).compile();

    service = module.get<AdresseFacturationsService>(AdresseFacturationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
