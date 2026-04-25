import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event, EventStatus } from '../events/entities/event.entity';

@Injectable()
export class ModerationService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
  ) {}

  // Get all events pending review
  getQueue() {
    return this.eventRepo.find({ where: { status: EventStatus.PENDING } });
  }

  async approve(eventId: number) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    event.status = EventStatus.APPROVED;
    await this.eventRepo.save(event);
    return { message: 'Event approved', event };
  }

  async reject(eventId: number) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    event.status = EventStatus.REJECTED;
    await this.eventRepo.save(event);
    return { message: 'Event rejected', event };
  }
}
