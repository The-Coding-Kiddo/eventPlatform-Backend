import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import * as bcrypt from 'bcrypt';


@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicEvents(filters: any = {}, pagination: PaginationDto = {}) {
    const { category, city, search, timeframe = 'all', institution } = filters;
    const { skip = 0, take = 10 } = pagination;
    const where: any = { status: 'approved' };
    const now = new Date();
    const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
    const currentTime = now.toTimeString().slice(0, 5);

    if (category) where.category = category;
    if (city) where.location = { contains: city, mode: 'insensitive' };
    if (timeframe === 'upcoming') {
      where.OR = [
        { date: { gt: today } },
        { date: today, time: { gte: currentTime } },
      ];
    }
    if (timeframe === 'past') {
      where.OR = [
        { date: { lt: today } },
        { date: today, time: { lt: currentTime } },
      ];
    }
    if (institution) where.institution = institution;
    if (search) {
      const searchFilter = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchFilter }];
        delete where.OR;
      } else {
        where.OR = searchFilter;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        orderBy: timeframe === 'past'
          ? [{ date: 'desc' }, { time: 'desc' }]
          : [{ date: 'asc' }, { time: 'asc' }],
        skip,
        take,
      }),
      this.prisma.event.count({ where }),
    ]);

    return { items, total, skip, take };
  }

  async fetchAllEvents(institutionId?: string, pagination: PaginationDto = {}) {
    const { skip = 0, take = 10 } = pagination;
    const where: any = {};
    if (institutionId) where.institution = institutionId;

    const [items, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.event.count({ where }),
    ]);

    return { items, total, skip, take };
  }

  async getEventById(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async submitEvent(data: CreateEventDto) {
    const event = await this.prisma.event.create({
      data: { ...data, status: 'pending', institution: data.institution ?? '' },
    });
    return { event };
  }

  async saveDraft(data: CreateEventDto) {
    const event = await this.prisma.event.create({
      data: { ...data, status: 'draft', institution: data.institution ?? '' },
    });
    return { event };
  }

  async updateEvent(id: string, data: UpdateEventDto, institution: string, role: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    
    // Allow super admin to edit any event or institution admin to edit their own
    if (role !== 'super_admin' && event.institution !== institution)
      throw new ForbiddenException('Unauthorized');
      
    if (event.status === 'approved' && role !== 'super_admin')
      throw new ForbiddenException('Cannot edit approved events');

    // Enterprise-grade RBAC checks:
    if (role !== 'super_admin') {
      // 1. Lock Institution: non-superadmins cannot hijack or transfer events to other institutions
      if (data.institution && data.institution !== institution) {
        throw new ForbiddenException('You cannot change the institution of this event.');
      }
      
      // 2. Lock Moderation Status: non-superadmins cannot approve or reject events
      if (data.status && data.status !== 'draft' && data.status !== 'pending') {
        throw new ForbiddenException('You do not have permission to moderate this event status.');
      }
    }

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
      if (event.status === 'pending')
        throw new ForbiddenException('Cannot delete events pending moderation');
    }

    await this.prisma.event.delete({ where: { id } });
    return { success: true };
  }

  // ── Citizen Interactions ──

  async saveEvent(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

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
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          capacity: true,
          attendees: true,
          waitlist: true,
        },
      });

      if (!event) throw new NotFoundException('Event not found');

      // 2. Check if user is already registered to prevent double counting
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          registeredEvents: {
            where: { id: eventId },
            select: { id: true },
          },
        },
      });

      if (user?.registeredEvents.length) {
        throw new BadRequestException('You are already registered for this event');
      }

      const waitlist = event.waitlist ?? [];
      const hasRoom = event.attendees < event.capacity;

      if (hasRoom) {
        await tx.event.update({
          where: { id: eventId },
          data: { attendees: { increment: 1 } },
        });

        await tx.user.update({
          where: { id: userId },
          data: { registeredEvents: { connect: { id: eventId } } },
        });

        return { success: true, status: 'registered' };
      }

      if (!waitlist.includes(userId)) {
        await tx.event.update({
          where: { id: eventId },
          data: { waitlist: { set: [...waitlist, userId] } },
        });
      }

      return { success: true, status: 'waitlisted' };
    });
  }

  async cancelRegistration(eventId: string, targetUserId: string, callerId?: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, institution: true, waitlist: true },
    });

    if (!event) throw new NotFoundException('Event not found');

    // Permission check for admins cancelling others
    if (callerId && callerId !== targetUserId) {
      const caller = await this.prisma.user.findUnique({
        where: { id: callerId },
        select: { role: true, institution: true },
      });
      if (!caller) throw new ForbiddenException('Caller session not found');

      const isAllowed =
        caller.role === 'super_admin' ||
        (caller.role === 'institution' &&
          caller.institution === event.institution);
      if (!isAllowed) {
        throw new ForbiddenException(
          'You do not have permission to cancel this registration',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Check if user is registered or waitlisted
      const user = await tx.user.findUnique({
        where: { id: targetUserId },
        select: {
          registeredEvents: {
            where: { id: eventId },
            select: { id: true },
          },
        },
      });

      const isRegistered = (user?.registeredEvents?.length ?? 0) > 0;
      const waitlist = event.waitlist ?? [];
      const isWaitlisted = waitlist.includes(targetUserId);

      if (!isRegistered && !isWaitlisted) {
        throw new BadRequestException('User is not registered or waitlisted for this event');
      }

      // Handle Waitlist Cancellation
      if (isWaitlisted) {
        await tx.event.update({
          where: { id: eventId },
          data: {
            waitlist: { set: waitlist.filter((id) => id !== targetUserId) },
          },
        });
        return { success: true, message: 'Removed from waitlist' };
      }

      // Handle Active Registration Cancellation
      await tx.event.update({
        where: { id: eventId },
        data: { attendees: { decrement: 1 } },
      });

      await tx.user.update({
        where: { id: targetUserId },
        data: { registeredEvents: { disconnect: { id: eventId } } },
      });

      // Promote next from waitlist if any
      if (waitlist.length) {
        const nextUserId = waitlist[0];
        await tx.event.update({
          where: { id: eventId },
          data: {
            waitlist: { set: waitlist.slice(1) },
            attendees: { increment: 1 },
          },
        });
        await tx.user.update({
          where: { id: nextUserId },
          data: { registeredEvents: { connect: { id: eventId } } },
        });

        return { success: true, promotedFromWaitlist: nextUserId };
      }

      return { success: true };
    });
  }

  async generateTicketQr(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        institution: true,
        registeredUsers: {
          where: { id: userId },
          select: { id: true },
        },
      },
    });

    if (!event) throw new NotFoundException('Event not found');
    if (!event.registeredUsers?.length) {
      throw new BadRequestException('User is not registered for this event');
    }

    const ticketCode = createHash('sha256')
      .update(`${eventId}:${userId}:${process.env.QR_SECRET ?? 'event-platform-qr'}`)
      .digest('hex')
      .slice(0, 18);

    const payload = {
      eventId,
      userId,
      ticketCode,
      issuedAt: new Date().toISOString(),
    };

    return {
      eventId,
      userId,
      ticketCode,
      qrData: Buffer.from(JSON.stringify(payload)).toString('base64url'),
    };
  }

  async checkInAttendee(eventId: string, callerId: string, qrData?: string) {
    let targetUserId = callerId;
    let isManualBypass = false;

    if (qrData) {
      try {
        const decoded = Buffer.from(
          qrData,
          qrData.includes('-') || qrData.includes('_') ? 'base64url' : 'base64',
        ).toString('utf8');
        const payload = JSON.parse(decoded);

        if (payload.userId) {
          targetUserId = payload.userId;
        }

        if (payload.manual) {
          isManualBypass = true;
        }

        if (!isManualBypass && payload.ticketCode) {
          const expectedTicketCode = createHash('sha256')
            .update(
              `${eventId}:${targetUserId}:${process.env.QR_SECRET ?? 'event-platform-qr'}`,
            )
            .digest('hex')
            .slice(0, 18);

          if (payload.ticketCode !== expectedTicketCode) {
            throw new BadRequestException('Invalid QR ticket code');
          }
        }
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          checkedInUsers: true,
          institution: true,
          registeredUsers: {
            where: { id: targetUserId },
            select: { id: true },
          },
        },
      });

      if (!event) throw new NotFoundException('Event not found');

      if (!event.registeredUsers?.length) {
        throw new BadRequestException('User is not registered for this event');
      }

      if (callerId !== targetUserId) {
        const caller = await tx.user.findUnique({
          where: { id: callerId },
          select: { role: true, institution: true },
        });
        if (!caller) throw new ForbiddenException('Caller session not found');

        const isAllowed =
          caller.role === 'super_admin' ||
          (caller.role === 'institution' &&
            caller.institution === event.institution);
        if (!isAllowed) {
          throw new ForbiddenException(
            'You do not have permission to check in this user',
          );
        }
      }

      const checkedInUsers = event.checkedInUsers ?? [];
      if (!checkedInUsers.includes(targetUserId)) {
        await tx.event.update({
          where: { id: eventId },
          data: { checkedInUsers: { set: [...checkedInUsers, targetUserId] } },
        });
      }

      return { success: true, checkedIn: true, userId: targetUserId };
    });
  }

  async getAttendees(id: string, institution: string, role: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      select: {
        id: true,
        institution: true,
        waitlist: true,
        checkedInUsers: true,
        registeredUsers: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
          },
        },
      },
    });

    if (!event) throw new NotFoundException('Event not found');

    // Security: Only allow if super_admin OR if it's the admin's own institution
    if (role !== 'super_admin' && event.institution !== institution) {
      throw new ForbiddenException(
        'You do not have permission to view attendees for this event.',
      );
    }

    const checkedInIds = event.checkedInUsers ?? [];

    // 1. Map registered users with 'registered' status
    const registered = event.registeredUsers.map((u) => ({
      ...u,
      status: 'registered',
      checkedIn: checkedInIds.includes(u.id),
    }));

    // 2. Fetch waitlisted users details
    let waitlisted: any[] = [];
    if (event.waitlist && event.waitlist.length > 0) {
      const waitlistUsers = await this.prisma.user.findMany({
        where: { id: { in: event.waitlist } },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      // Sort according to the order in the waitlist array
      waitlisted = event.waitlist
        .map((userId) => waitlistUsers.find((u) => u.id === userId))
        .filter(Boolean)
        .map((u) => ({
          ...u,
          status: 'waitlisted',
          checkedIn: false, // Waitlisted people can't be checked in
        }));
    }

    // Return unified list
    return [...registered, ...waitlisted];
  }

  async inviteAttendee(
    eventId: string,
    email: string,
    name: string,
    adminInstitution: string,
    adminRole: string,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, capacity: true, attendees: true, institution: true },
    });

    if (!event) throw new NotFoundException('Event not found');

    // Access control: only super_admin or the owner institution admin
    if (adminRole !== 'super_admin' && event.institution !== adminInstitution) {
      throw new ForbiddenException('You do not have permission to invite attendees to this event.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Find or create user
      let user = await tx.user.findUnique({ where: { email } });
      if (!user) {
        // Create user with a secure default hashed password
        const tempPassword = await bcrypt.hash('invited123', 10);
        user = await tx.user.create({
          data: {
            name: name || email.split('@')[0],
            email,
            password: tempPassword,
            role: 'citizen',
          },
        });
      } else {
        // Check if already registered
        const alreadyRegistered = await tx.user.findFirst({
          where: {
            id: user.id,
            registeredEvents: { some: { id: eventId } },
          },
        });
        if (alreadyRegistered) {
          throw new BadRequestException('User is already registered for this event');
        }
      }

      // 2. Check and update capacity
      const currentEvent = await tx.event.findUnique({
        where: { id: eventId },
        select: { capacity: true, attendees: true },
      });

      if (currentEvent && currentEvent.attendees >= currentEvent.capacity) {
        throw new BadRequestException('Event is at capacity');
      }

      // 3. Connect and increment
      await tx.event.update({
        where: { id: eventId },
        data: { attendees: { increment: 1 } },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { registeredEvents: { connect: { id: eventId } } },
      });

      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      };
    });
  }
}
