import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
  ) {}

  findAll(user: User) {
    return this.notifRepo.find({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
    });
  }

  async markOneRead(id: number, user: User) {
    const notif = await this.notifRepo.findOne({
      where: { id, userId: user.id },
    });
    if (!notif) throw new NotFoundException('Notification not found');
    notif.isRead = true;
    await this.notifRepo.save(notif);
    return { message: 'Marked as read' };
  }

  async markAllRead(user: User) {
    await this.notifRepo.update({ userId: user.id, isRead: false }, { isRead: true });
    return { message: 'All notifications marked as read' };
  }

  // Helper used by other services to create notifications
  async create(userId: number, message: string, eventId?: number) {
    const notif = this.notifRepo.create({ userId, message, eventId });
    return this.notifRepo.save(notif);
  }
}
