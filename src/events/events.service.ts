import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicEvents() {
    return this.prisma.event.findMany({
      where: { status: 'approved' },
      orderBy: { date: 'asc' },
    });
  }

  async getEventById(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async submitEvent(data: CreateEventDto) {
    const event = await this.prisma.event.create({
      data: { ...data, status: 'pending' },
    });
    return { event };
  }

  async saveDraft(data: CreateEventDto) {
    const event = await this.prisma.event.create({
      data: { ...data, status: 'draft' },
    });
    return { event };
  }

  async updateEvent(id: string, data: UpdateEventDto, institution: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.institution !== institution)
      throw new ForbiddenException('Unauthorized');
    if (event.status === 'approved')
      throw new ForbiddenException('Cannot edit approved events');

    return this.prisma.event.update({ where: { id }, data });
  }

  async deleteEvent(id: string, institution: string, role: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');

    if (role !== 'super_admin') {
      if (event.institution !== institution)
        throw new ForbiddenException('Unauthorized');
      if (event.status === 'approved')
        throw new ForbiddenException('Cannot delete approved events');
    }

    await this.prisma.event.delete({ where: { id } });
    return { success: true };
  }

  // ── Citizen Interactions ──

  async saveEvent(eventId: string, userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { savedEvents: { connect: { id: eventId } } },
    });
    return { success: true };
  }

  async unsaveEvent(eventId: string, userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { savedEvents: { disconnect: { id: eventId } } },
    });
    return { success: true };
  }

  async registerForEvent(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (event.attendees >= event.capacity)
      throw new BadRequestException('Event is at capacity');

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { registeredEvents: { connect: { id: eventId } } },
      }),
      this.prisma.event.update({
        where: { id: eventId },
        data: { attendees: { increment: 1 } },
      }),
    ]);
    return { success: true };
  }

  async cancelRegistration(eventId: string, userId: string) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { registeredEvents: { disconnect: { id: eventId } } },
      }),
      this.prisma.event.update({
        where: { id: eventId },
        data: { attendees: { decrement: 1 } },
      }),
    ]);
    return { success: true };
  }
}
