import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

const mockPrisma = {
  event: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  user: { findUnique: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
};

const mockEvent = {
  id: 'event-1',
  title: 'Test Event',
  category: 'Tech',
  date: '2026-06-01',
  time: '10:00',
  location: 'Nairobi',
  venue: 'KICC',
  institution: 'University A',
  description: 'A test event',
  price: 0,
  capacity: 100,
  attendees: 0,
  tags: [],
  image: null,
  status: 'approved' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCreateDto = {
  title: 'Test Event', category: 'Tech', date: '2026-06-01', time: '10:00',
  location: 'Nairobi', venue: 'KICC', institution: 'University A',
  description: 'A test event', price: 0, capacity: 100, tags: [],
};

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<EventsService>(EventsService);
  });

  describe('getPublicEvents', () => {
    it('returns paginated approved events', async () => {
      mockPrisma.event.findMany.mockResolvedValue([mockEvent]);
      mockPrisma.event.count.mockResolvedValue(1);
      const result = await service.getPublicEvents({}, { skip: 0, take: 10 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'approved' }) }),
      );
    });

    it('applies category filter', async () => {
      mockPrisma.event.findMany.mockResolvedValue([]);
      mockPrisma.event.count.mockResolvedValue(0);
      await service.getPublicEvents({ category: 'Music' }, {});
      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ category: 'Music' }) }),
      );
    });
  });

  describe('getEventById', () => {
    it('returns event when found', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(mockEvent);
      const result = await service.getEventById('event-1');
      expect(result).toEqual(mockEvent);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);
      await expect(service.getEventById('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitEvent', () => {
    it('creates event with status = pending', async () => {
      mockPrisma.event.create.mockResolvedValue({ ...mockEvent, status: 'pending' });
      const result = await service.submitEvent(mockCreateDto);
      expect(result.event.status).toBe('pending');
    });
  });

  describe('updateEvent', () => {
    it('allows institution to update their own draft event', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ ...mockEvent, status: 'draft' });
      mockPrisma.event.update.mockResolvedValue({ ...mockEvent, title: 'Updated' });
      const result = await service.updateEvent('event-1', { title: 'Updated' }, 'University A', 'institution');
      expect(result.title).toBe('Updated');
    });

    it('throws ForbiddenException when admin edits another institution event', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(mockEvent);
      await expect(service.updateEvent('event-1', {}, 'University B', 'institution')).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when admin edits an approved event', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ ...mockEvent, status: 'approved' });
      await expect(service.updateEvent('event-1', {}, 'University A', 'institution')).rejects.toThrow(ForbiddenException);
    });

    it('allows super_admin to edit any approved event', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ ...mockEvent, status: 'approved' });
      mockPrisma.event.update.mockResolvedValue(mockEvent);
      await expect(service.updateEvent('event-1', {}, 'any', 'super_admin')).resolves.toBeDefined();
    });
  });

  describe('deleteEvent', () => {
    it('throws NotFoundException when event not found', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);
      await expect(service.deleteEvent('bad-id', 'University A', 'institution')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when deleting another institution event', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ ...mockEvent, status: 'draft' });
      await expect(service.deleteEvent('event-1', 'University B', 'institution')).rejects.toThrow(ForbiddenException);
    });

    it('allows super_admin to delete any event', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ ...mockEvent, status: 'approved' });
      mockPrisma.event.delete.mockResolvedValue(mockEvent);
      const result = await service.deleteEvent('event-1', '', 'super_admin');
      expect(result.success).toBe(true);
    });
  });

  describe('registerForEvent', () => {
    const makeTx = (overrides: any = {}) => ({
      event: {
        findUnique: jest.fn().mockResolvedValue({ id: 'event-1', capacity: 100, attendees: 0, waitlist: [] }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
        ...overrides.event,
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ registeredEvents: [] }),
        update: jest.fn().mockResolvedValue({}),
        ...overrides.user,
      },
    });

    it('registers user successfully', async () => {
      mockPrisma.$transaction.mockImplementation((fn: (tx: any) => Promise<any>) => fn(makeTx()));
      const result = await service.registerForEvent('event-1', 'user-1');
      expect(result.success).toBe(true);
    });

    it('throws BadRequestException when already registered', async () => {
      const tx = makeTx({ user: { findUnique: jest.fn().mockResolvedValue({ registeredEvents: [{ id: 'event-1' }] }) } });
      mockPrisma.$transaction.mockImplementation((fn: (tx: any) => Promise<any>) => fn(tx));
      await expect(service.registerForEvent('event-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('waitlists the user when capacity is full', async () => {
      const tx = makeTx({
        event: {
          findUnique: jest.fn().mockResolvedValue({ id: 'event-1', capacity: 1, attendees: 1, waitlist: [] }),
          update: jest.fn().mockResolvedValue({}),
        },
      });
      mockPrisma.$transaction.mockImplementation((fn: (tx: any) => Promise<any>) => fn(tx));

      const result = await service.registerForEvent('event-1', 'user-1');

      expect(result.status).toBe('waitlisted');
      expect(tx.event.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ waitlist: { set: ['user-1'] } }) }));
    });

    it('adds the user to the waitlist when capacity is full', async () => {
      const tx = makeTx({
        event: {
          findUnique: jest.fn().mockResolvedValue({ id: 'event-1', capacity: 1, attendees: 1, waitlist: [] }),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          update: jest.fn().mockResolvedValue({}),
        },
      });
      mockPrisma.$transaction.mockImplementation((fn: (tx: any) => Promise<any>) => fn(tx));

      const result = await service.registerForEvent('event-1', 'user-1');

      expect(result.status).toBe('waitlisted');
      expect(tx.event.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ waitlist: { set: ['user-1'] } }) }));
    });
  });

  describe('generateTicketQr', () => {
    it('returns a QR payload for a registered attendee', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'event-1', institution: 'University A', registeredUsers: [{ id: 'user-1' }] });

      const result = await service.generateTicketQr('event-1', 'user-1');

      const decoded = JSON.parse(Buffer.from(result.qrData, 'base64url').toString('utf8'));
      expect(decoded.eventId).toBe('event-1');
      expect(decoded.userId).toBe('user-1');
      expect(result.ticketCode).toBeDefined();
    });
  });

  describe('checkInAttendee', () => {
    it('marks a registered attendee as checked in', async () => {
      const tx = {
        event: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'event-1',
            checkedInUsers: [],
            registeredUsers: [{ id: 'user-1' }],
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        user: {
          findUnique: jest.fn().mockResolvedValue({ registeredEvents: [{ id: 'event-1' }] }),
        },
      };
      mockPrisma.$transaction.mockImplementation((fn: (tx: any) => Promise<any>) => fn(tx));

      const result = await service.checkInAttendee('event-1', 'user-1', 'any-code');

      expect(result.success).toBe(true);
      expect(tx.event.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ checkedInUsers: { set: ['user-1'] } }) }));
    });
  });

  describe('cancelRegistration', () => {
    it('cancels and decrements attendees', async () => {
      mockPrisma.$transaction.mockImplementation((fn: (tx: any) => Promise<any>) => fn({
        event: {
          findUnique: jest.fn().mockResolvedValue({ waitlist: [] }),
          update: jest.fn().mockResolvedValue({}),
        },
        user: { findUnique: jest.fn().mockResolvedValue({ registeredEvents: [{ id: 'event-1' }] }), update: jest.fn().mockResolvedValue({}) },
      }));
      const result = await service.cancelRegistration('event-1', 'user-1');
      expect(result.success).toBe(true);
    });

    it('throws BadRequestException when not registered', async () => {
      mockPrisma.$transaction.mockImplementation((fn: (tx: any) => Promise<any>) => fn({
        user: { findUnique: jest.fn().mockResolvedValue({ registeredEvents: [] }) },
      }));
      await expect(service.cancelRegistration('event-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAttendees', () => {
    it('returns attendees for own institution admin', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ institution: 'University A', registeredUsers: [{ id: 'u1' }] });
      const result = await service.getAttendees('event-1', 'University A', 'institution');
      expect(result).toHaveLength(1);
    });

    it('throws ForbiddenException for wrong institution', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ institution: 'University A', registeredUsers: [] });
      await expect(service.getAttendees('event-1', 'University B', 'institution')).rejects.toThrow(ForbiddenException);
    });
  });
});
