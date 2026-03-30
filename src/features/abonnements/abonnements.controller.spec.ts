import { Test, TestingModule } from '@nestjs/testing';
import { AbonnementsController } from './abonnements.controller';
import { AbonnementsService } from './abonnements.service';

describe('AbonnementsController', () => {
  let controller: AbonnementsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AbonnementsController],
      providers: [AbonnementsService],
    }).compile();

    controller = module.get<AbonnementsController>(AbonnementsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
