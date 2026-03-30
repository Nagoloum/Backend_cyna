import { Test, TestingModule } from '@nestjs/testing';
import { AdresseFacturationsController } from './adresse_facturations.controller';
import { AdresseFacturationsService } from './adresse_facturations.service';

describe('AdresseFacturationsController', () => {
  let controller: AdresseFacturationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdresseFacturationsController],
      providers: [AdresseFacturationsService],
    }).compile();

    controller = module.get<AdresseFacturationsController>(AdresseFacturationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
