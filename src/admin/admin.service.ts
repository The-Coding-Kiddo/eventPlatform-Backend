import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateStatusDto } from './dto/update-status.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // Fetch all events waiting for approval
  async getPendingEvents() {
    return this.prisma.event.findMany({
      where: { status: 'pending' },
      orderBy: { date: 'asc' },
    });
  }

  // Approve or Reject an event
  async updateEventStatus(id: string, data: UpdateStatusDto) {
    const event = await this.prisma.event.findUnique({ where: { id } });

    if (!event) {
      throw new NotFoundException('Event not found.');
    }

    return this.prisma.event.update({
      where: { id },
      data: { status: data.status },
    });
  }
}
