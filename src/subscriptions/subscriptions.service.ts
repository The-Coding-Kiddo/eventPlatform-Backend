import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async subscribe(category: string, user: User) {
    const fullUser = await this.userRepo.findOne({ where: { id: user.id } });
    if (!fullUser) throw new NotFoundException('User not found');

    const subs = fullUser.subscriptions ?? [];
    if (!subs.includes(category)) {
      fullUser.subscriptions = [...subs, category];
      await this.userRepo.save(fullUser);
    }
    return { message: `Subscribed to ${category}`, subscriptions: fullUser.subscriptions };
  }

  async unsubscribe(category: string, user: User) {
    const fullUser = await this.userRepo.findOne({ where: { id: user.id } });
    if (!fullUser) throw new NotFoundException('User not found');

    fullUser.subscriptions = (fullUser.subscriptions ?? []).filter((c) => c !== category);
    await this.userRepo.save(fullUser);
    return { message: `Unsubscribed from ${category}`, subscriptions: fullUser.subscriptions };
  }
}
