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
    if (dto.userId) {
      return this.prisma.notification.create({ data: dto });
    }

    const where: any = {};
    if (dto.forRole) where.role = dto.forRole as any;
    if (dto.forInstitution) where.institution = dto.forInstitution;
    if (dto.forCategory) where.subscriptions = { has: dto.forCategory };

    const targetUsers = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });

    if (targetUsers.length > 0) {
      const data = targetUsers.map((u) => ({
        ...dto,
        userId: u.id,
      }));
      
      await this.prisma.notification.createMany({ data });
      
      const first = await this.prisma.notification.findFirst({
        where: { userId: targetUsers[0].id, title: dto.title },
        orderBy: { createdAt: 'desc' }
      });
      return first || { id: 'dummy', ...dto };
    }

    // Fallback if no users match
    return this.prisma.notification.create({ data: dto });
  }

  async findForUser(
    userId: string,
    role: string,
    institution?: string,
  ) {
    let subs: string[] = [];
    if (role === 'citizen') {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { subscriptions: true } });
      if (u) subs = u.subscriptions;
    }

    return this.prisma.notification.findMany({
      where: {
        OR: [
          { userId },
          { userId: null, forRole: null },
          {
            userId: null,
            forRole: role,
            ...(role === 'institution_admin'
              ? { OR: [{ forInstitution: null }, { forInstitution: institution }] }
              : role === 'citizen'
              ? { OR: [{ forCategory: null }, { forCategory: { in: subs } }] }
              : {}),
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markRead(id: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllRead(userId: string, role: string, institution?: string) {
    let subs: string[] = [];
    if (role === 'citizen') {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { subscriptions: true } });
      if (u) subs = u.subscriptions;
    }

    const result = await this.prisma.notification.updateMany({
      where: {
        read: false,
        OR: [
          { userId },
          { userId: null, forRole: null },
          {
            userId: null,
            forRole: role,
            ...(role === 'institution_admin'
              ? { OR: [{ forInstitution: null }, { forInstitution: institution }] }
              : role === 'citizen'
              ? { OR: [{ forCategory: null }, { forCategory: { in: subs } }] }
              : {}),
          },
        ],
      },
      data: { read: true },
    });
    return { updatedCount: result.count };
  }

  async remove(id: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif) throw new NotFoundException('Notification not found');
    await this.prisma.notification.delete({ where: { id } });
    return { success: true };
  }
}
