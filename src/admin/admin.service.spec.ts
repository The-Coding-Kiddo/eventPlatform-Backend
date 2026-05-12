import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  event: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    groupBy: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
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
  description: 'Desc',
  price: 0,
  capacity: 100,
  attendees: 0,
  tags: [],
  image: null,
  status: 'pending' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<AdminService>(AdminService);
  });

  // ── getModerationQueue ─────────────────────────────────────────────────────
  describe('getModerationQueue', () => {
    it('returns paginated moderation queue with mapped statuses', async () => {
      mockPrisma.event.findMany.mockResolvedValue([mockEvent]);
      mockPrisma.event.count.mockResolvedValue(1);

      const result = await service.getModerationQueue(undefined, { skip: 0, take: 10 });

      expect(result.total).toBe(1);
      expect(result.items[0]).toHaveProperty('eventTitle', 'Test Event');
      expect(result.items[0].status).toBe('pending_review');
    });

    it('filters by status when provided', async () => {
      mockPrisma.event.findMany.mockResolvedValue([]);
      mockPrisma.event.count.mockResolvedValue(0);

      await service.getModerationQueue('approved', {});

      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'approved' }) }),
      );
    });
  });

  // ── approveEventInQueue ────────────────────────────────────────────────────
  describe('approveEventInQueue', () => {
    it('sets event status to approved', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(mockEvent);
      mockPrisma.event.update.mockResolvedValue({ ...mockEvent, status: 'approved' });

      const result = await service.approveEventInQueue('event-1', 'Looks good');

      expect(mockPrisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'approved' } }),
      );
      expect(result.queueItem.status).toBe('approved');
    });

    it('throws NotFoundException when event not found', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);
      await expect(service.approveEventInQueue('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── rejectEventInQueue ─────────────────────────────────────────────────────
  describe('rejectEventInQueue', () => {
    it('sets event status to rejected', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(mockEvent);
      mockPrisma.event.update.mockResolvedValue({ ...mockEvent, status: 'rejected' });

      const result = await service.rejectEventInQueue('event-1', 'Policy violation');
      expect(result.queueItem.status).toBe('rejected');
    });
  });

  // ── getAnalytics ───────────────────────────────────────────────────────────
  describe('getAnalytics', () => {
    it('returns correct analytics shape using DB aggregations', async () => {
      // count() calls in order
      mockPrisma.event.count
        .mockResolvedValueOnce(10)  // totalEvents
        .mockResolvedValueOnce(3)   // pending
        .mockResolvedValueOnce(5)   // approved
        .mockResolvedValueOnce(2)   // rejected
        .mockResolvedValueOnce(4);  // eventsThisMonth
      mockPrisma.user.count.mockResolvedValue(20); // totalCitizens

      mockPrisma.event.groupBy
        .mockResolvedValueOnce([{ category: 'Tech', _count: { id: 5 } }]) // categoryGroups
        .mockResolvedValueOnce([{ location: 'Nairobi', _count: { id: 3 } }]); // cityGroups

      mockPrisma.user.findMany.mockResolvedValue([
        { institution: 'MIT', suspended: false },
        { institution: 'KU', suspended: true },
      ]);

      const result = await service.getAnalytics();

      expect(result.totalEvents).toBe(10);
      expect(result.approvedEvents).toBe(5);
      expect(result.rejectedEvents).toBe(2);
      expect(result.approvalRate).toBe(71); // 5/(5+2)*100 = 71
      expect(result.totalInstitutions).toBe(2);
      expect(result.activeInstitutions).toBe(1); // only MIT is not suspended
      expect(result.totalUsers).toBe(20);
      expect(result.categoryDistribution).toEqual([{ name: 'Tech', value: 5 }]);
      expect(result.topCities).toEqual([{ city: 'Nairobi', count: 3 }]);
    });

    it('returns approvalRate = 0 when no events reviewed', async () => {
      mockPrisma.event.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.event.groupBy.mockResolvedValue([]).mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.getAnalytics();
      expect(result.approvalRate).toBe(0);
    });
  });

  // ── getUsers ───────────────────────────────────────────────────────────────
  describe('getUsers', () => {
    it('returns users without password field', async () => {
      const user = { id: 'u1', name: 'Alice', email: 'a@t.com', password: 'hash', role: 'citizen', createdAt: new Date() };
      mockPrisma.user.findMany.mockResolvedValue([user]);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await service.getUsers({});
      expect(result.items[0]).not.toHaveProperty('password');
    });
  });

  // ── suspendInstitution / unsuspendInstitution ──────────────────────────────
  describe('suspendInstitution', () => {
    it('sets suspended = true for all institution admins', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
      const result = await service.suspendInstitution('MIT');
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { suspended: true } }),
      );
      expect(result.status).toBe('suspended');
    });
  });

  describe('unsuspendInstitution', () => {
    it('sets suspended = false for all institution admins', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
      const result = await service.unsuspendInstitution('MIT');
      expect(result.status).toBe('active');
    });
  });
});
