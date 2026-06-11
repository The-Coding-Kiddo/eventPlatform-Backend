import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  notification: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockNotif = {
  id: 'notif-1',
  type: 'new_event',
  title: 'New Event!',
  message: 'A new event has been added.',
  read: false,
  userId: 'user-1',
  forRole: null,
  forCategory: null,
  forInstitution: null,
  eventId: null,
  createdAt: new Date(),
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<NotificationsService>(NotificationsService);
  });

  // ── create ─────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('creates a direct notification when userId is set', async () => {
      const dto = { type: 'new_event', title: 'Hi', message: 'Test', userId: 'user-1' };
      mockPrisma.notification.create.mockResolvedValue({ ...mockNotif, ...dto });

      const result = await service.create(dto as any);

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({ data: dto });
      expect(result).toHaveProperty('userId', 'user-1');
    });

    it('fan-outs to matching users when forRole is set', async () => {
      const dto = { type: 'announcement', title: 'Admin Notice', message: 'For all admins', forRole: 'institution' };
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.notification.findFirst.mockResolvedValue({ ...mockNotif, userId: 'u1' });

      await service.create(dto as any);

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ userId: 'u1' }),
            expect.objectContaining({ userId: 'u2' }),
          ]),
        }),
      );
    });

    it('falls back to direct create when no users match broadcast', async () => {
      const dto = { type: 'announcement', title: 'Nobody', message: 'No audience', forRole: 'institution' };
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.notification.create.mockResolvedValue({ ...mockNotif, ...dto, userId: null });

      await service.create(dto as any);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  // ── findForUser ────────────────────────────────────────────────────────────
  describe('findForUser', () => {
    it('fetches notifications for citizen with subscriptions', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ subscriptions: ['Tech'] });
      mockPrisma.notification.findMany.mockResolvedValue([mockNotif]);

      const result = await service.findForUser('user-1', 'citizen');

      expect(mockPrisma.user.findUnique).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('does not look up subscriptions for institution', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);

      await service.findForUser('user-1', 'institution', 'MIT');

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── markRead ───────────────────────────────────────────────────────────────
  describe('markRead', () => {
    it('marks a notification as read', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(mockNotif);
      mockPrisma.notification.update.mockResolvedValue({ ...mockNotif, read: true });

      const result = await service.markRead('notif-1');
      expect(mockPrisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { read: true } }),
      );
      expect(result.read).toBe(true);
    });

    it('throws NotFoundException when notification not found', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);
      await expect(service.markRead('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── markAllRead ────────────────────────────────────────────────────────────
  describe('markAllRead', () => {
    it('marks all unread notifications as read for the user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ subscriptions: [] });
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.markAllRead('user-1', 'citizen');
      expect(result.updatedCount).toBe(3);
    });
  });

  // ── remove ─────────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('deletes a notification', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(mockNotif);
      mockPrisma.notification.delete.mockResolvedValue(mockNotif);

      const result = await service.remove('notif-1');
      expect(result.success).toBe(true);
    });

    it('throws NotFoundException when notification not found', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);
      await expect(service.remove('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
