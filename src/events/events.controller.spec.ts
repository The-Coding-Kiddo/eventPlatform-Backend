import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

const mockEventsService = {
  getPublicEvents: jest.fn(),
  fetchAllEvents: jest.fn(),
  getEventById: jest.fn(),
  submitEvent: jest.fn(),
  saveDraft: jest.fn(),
  updateEvent: jest.fn(),
  deleteEvent: jest.fn(),
  saveEvent: jest.fn(),
  unsaveEvent: jest.fn(),
  registerForEvent: jest.fn(),
  cancelRegistration: jest.fn(),
  getAttendees: jest.fn(),
  generateTicketQr: jest.fn(),
  checkInAttendee: jest.fn(),
};

const mockAuditService = {
  log: jest.fn(),
};

describe('EventsController', () => {
  let controller: EventsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        { provide: EventsService, useValue: mockEventsService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<EventsController>(EventsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
