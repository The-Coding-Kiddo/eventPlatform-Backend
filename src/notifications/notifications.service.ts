import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new notification.
   * When userId is set it targets that specific user.
   * When forRole / forCategory / forInstitution are set the frontend
   * filters the list on its side using the same fields.
   */
  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({ data: dto });
  }

  /**
   * Return notifications visible to the calling user.
   * Scoping rules (mirrors the frontend NotificationContext logic):
   *   - userId === caller       → always shown
   *   - forRole === caller.role → shown (caller checks category/institution client-side)
   *   - no userId & no forRole  → broadcast shown to everyone
   */
  async findForUser(
    userId: string,
    role: string,
    institution?: string,
  ) {
    return this.prisma.notification.findMany({
      where: {
        OR: [
          // Direct user notification
          { userId },
          // Role-targeted broadcast
          { userId: null, forRole: role },
          // Global broadcast (no targeting)
          { userId: null, forRole: null },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Mark a single notification as read. Returns the updated notification. */
  async markRead(id: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  /** Mark all notifications visible to the calling user as read. */
  async markAllRead(userId: string, role: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        read: false,
        OR: [
          { userId },
          { userId: null, forRole: role },
          { userId: null, forRole: null },
        ],
      },
      data: { read: true },
    });
    return { updatedCount: result.count };
  }

  /** Delete a notification by ID. */
  async remove(id: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif) throw new NotFoundException('Notification not found');
    await this.prisma.notification.delete({ where: { id } });
    return { success: true };
  }
}
