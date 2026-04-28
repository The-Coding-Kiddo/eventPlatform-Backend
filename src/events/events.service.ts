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

  async getPublicEvents(filters: any = {}) {
    const { category, city, search } = filters;
    const where: any = { status: 'approved' };

    if (category) where.category = category;
    if (city) where.location = { contains: city, mode: 'insensitive' };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.event.findMany({
      where,
      orderBy: { date: 'asc' },
    });
  }

  async fetchAllEvents(institutionId?: string) {
    const where: any = {};
    if (institutionId) where.institution = institutionId;
    return this.prisma.event.findMany({ where, orderBy: { createdAt: 'desc' } });
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
    
    // Allow super admin to edit or institution admin to edit their own
    if (institution !== 'super_admin' && event.institution !== institution)
      throw new ForbiddenException('Unauthorized');
      
    if (event.status === 'approved' && institution !== 'super_admin')
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
