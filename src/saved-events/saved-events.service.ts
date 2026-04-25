import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Event } from '../events/entities/event.entity';

@Injectable()
export class SavedEventsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
  ) {}

  async save(eventId: number, user: User) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const fullUser = await this.userRepo.findOneOrFail({
      where: { id: user.id },
      relations: ['savedEvents'],
    });

    const alreadySaved = fullUser.savedEvents.some((e) => e.id === eventId);
    if (!alreadySaved) {
      fullUser.savedEvents.push(event);
      await this.userRepo.save(fullUser);
    }
    return { message: 'Event saved' };
  }

  async unsave(eventId: number, user: User) {
    const fullUser = await this.userRepo.findOneOrFail({
      where: { id: user.id },
      relations: ['savedEvents'],
    });
    fullUser.savedEvents = fullUser.savedEvents.filter((e) => e.id !== eventId);
    await this.userRepo.save(fullUser);
    return { message: 'Event unsaved' };
  }
}
