import { Test, TestingModule } from '@nestjs/testing';
import { InstitutionController } from './institution.controller';
import { InstitutionService } from './institution.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

const mockInstitutionService = {
  getModerationQueue: jest.fn(),
  approveEventInQueue: jest.fn(),
  rejectEventInQueue: jest.fn(),
  getAnalytics: jest.fn(),
  getUsers: jest.fn(),
  updateUser: jest.fn(),
  getInstitutions: jest.fn(),
  suspendInstitution: jest.fn(),
  unsuspendInstitution: jest.fn(),
  updateEventStatus: jest.fn(),
};

describe('InstitutionController', () => {
  let controller: InstitutionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InstitutionController],
      providers: [{ provide: InstitutionService, useValue: mockInstitutionService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InstitutionController>(InstitutionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
