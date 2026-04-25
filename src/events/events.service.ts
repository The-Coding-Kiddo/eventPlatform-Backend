import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  // Fetch only approved, public events
  async getPublicEvents() {
    return this.prisma.event.findMany({
      where: {
        status: 'approved',
      },
      orderBy: {
        date: 'asc', // Sort by soonest first
      },
    });
  }

  // Fetch a single event by ID
  async getEventById(id: string) {
    return this.prisma.event.findUnique({
      where: { id },
    });
  }

  // Submit a new event (automatically goes to pending status)
  async submitEvent(data: CreateEventDto) {
    const event = await this.prisma.event.create({
      data: {
        ...data,
        status: 'pending', // Requires super_admin approval later
      },
    });

    return { event };
  }
}
