import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Registration } from './entities/registration.entity';
import { Event } from '../events/entities/event.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class RegistrationsService {
  constructor(
    @InjectRepository(Registration)
    private readonly regRepo: Repository<Registration>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
  ) {}

  async register(eventId: number, user: User) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const existing = await this.regRepo.findOne({
      where: { userId: user.id, eventId },
    });
    if (existing) throw new ConflictException('Already registered for this event');

    const reg = this.regRepo.create({ userId: user.id, eventId });
    await this.regRepo.save(reg);

    // Increment attendees count
    event.attendees += 1;
    await this.eventRepo.save(event);

    return { message: 'Registered successfully' };
  }

  async cancel(eventId: number, user: User) {
    const reg = await this.regRepo.findOne({
      where: { userId: user.id, eventId },
    });
    if (!reg) throw new NotFoundException('Registration not found');

    await this.regRepo.remove(reg);

    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (event && event.attendees > 0) {
      event.attendees -= 1;
      await this.eventRepo.save(event);
    }

    return { message: 'Registration cancelled' };
  }
}
