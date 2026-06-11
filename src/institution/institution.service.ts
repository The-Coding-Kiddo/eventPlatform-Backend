import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateStatusDto } from './dto/update-status.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class InstitutionService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Original Methods ──────────────────────────────────────────────

  async getPendingEvents() {
    return this.prisma.event.findMany({
      where: { status: 'pending' },
      orderBy: { date: 'asc' },
    });
  }

  async updateEventStatus(id: string, data: UpdateStatusDto) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found.');
    return this.prisma.event.update({ where: { id }, data: { status: data.status } });
  }

  // ── Moderation Queue ─────────────────────────────────────────────
  // The "moderation queue" is just events with non-draft statuses,
  // mapped to the shape the frontend expects.

  async getModerationQueue(status?: string, pagination: PaginationDto = {}) {
    const { skip = 0, take = 10 } = pagination;
    // Map frontend status names → DB event statuses
    const statusMap: Record<string, string> = {
      pending_review: 'pending',
      pending: 'pending',
      approved: 'approved',
      rejected: 'rejected',
    };
    const dbStatus = status ? statusMap[status] ?? status : undefined;

    const where = dbStatus ? { status: dbStatus as any } : { status: { not: 'draft' } };

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.event.count({ where }),
    ]);

    // Map events to queue item shape
    const items = events.map((e) => ({
      id: e.id,
      eventId: e.id,
      eventTitle: e.title,
      submittedBy: e.institution,
      institution: e.institution,
      category: e.category,
      location: e.location,
      date: e.date,
      submittedAt: e.createdAt.toISOString(),
      status: e.status === 'pending' ? 'pending_review' : e.status,
      riskScore: 0,
      riskLevel: 'low',
      flagReason: null,
      autoFlags: [],
      requiresManualReview: false,
      note: '',
      description: e.description,
      tags: e.tags,
      time: e.time,
      price: e.price,
      capacity: e.capacity,
      venue: e.venue,
    }));

    return { items, total, skip, take };
  }

  async approveEventInQueue(eventId: string, note?: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found.');

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: { status: 'approved' },
    });

    return {
      queueItem: {
        id: updated.id,
        eventId: updated.id,
        eventTitle: updated.title,
        institution: updated.institution,
        status: 'approved',
        note: note ?? '',
        resolvedAt: new Date().toISOString(),
      },
      event: updated,
    };
  }

  async rejectEventInQueue(eventId: string, note?: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found.');

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: { status: 'rejected' },
    });

    return {
      queueItem: {
        id: updated.id,
        eventId: updated.id,
        eventTitle: updated.title,
        institution: updated.institution,
        status: 'rejected',
        note: note ?? '',
        resolvedAt: new Date().toISOString(),
      },
      event: updated,
    };
  }

  // ── Analytics ────────────────────────────────────────────────────

  async getAnalytics() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalEvents,
      pendingEvents,
      approvedEvents,
      rejectedEvents,
      totalCitizens,
      eventsThisMonth,
      categoryGroups,
      cityGroups,
      institutionAdmins,
    ] = await Promise.all([
      this.prisma.event.count(),
      this.prisma.event.count({ where: { status: 'pending' } }),
      this.prisma.event.count({ where: { status: 'approved' } }),
      this.prisma.event.count({ where: { status: 'rejected' } }),
      this.prisma.user.count({ where: { role: 'citizen' } }),
      this.prisma.event.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.event.groupBy({
        by: ['category'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      this.prisma.event.groupBy({
        by: ['location'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      this.prisma.user.findMany({
        where: { role: 'institution' },
        select: { institution: true, suspended: true },
      }),
    ]);

    const reviewed = approvedEvents + rejectedEvents;

    const instMap = new Map<string, boolean>();
    for (const u of institutionAdmins) {
      if (u.institution && !instMap.has(u.institution)) {
        instMap.set(u.institution, u.suspended);
      }
    }

    const categoryDistribution = categoryGroups.map((g) => ({
      name: g.category,
      value: g._count.id,
    }));

    const topCities = cityGroups.map((g) => ({
      city: g.location,
      count: g._count.id,
    }));

    return {
      totalEvents,
      pendingModeration: pendingEvents,
      approvedEvents,
      rejectedEvents,
      approvalRate: reviewed ? Math.round((approvedEvents / reviewed) * 100) : 0,
      avgRiskScore: 0,
      totalInstitutions: instMap.size,
      activeInstitutions: [...instMap.values()].filter((suspended) => !suspended).length,
      totalUsers: totalCitizens,
      eventsThisMonth,
      monthlyEvents: [],
      categoryDistribution,
      topCities,
      recentActivity: [],
    };
  }

  // ── Users ────────────────────────────────────────────────────────

  async getUsers(pagination: PaginationDto = {}) {
    const { skip = 0, take = 10 } = pagination;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.user.count(),
    ]);
    const items = users.map(({ password: _, ...u }) => u);
    return { items, total, skip, take };
  }

  async updateUser(id: string, data: { status: 'active' | 'suspended' }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');
    const updated = await this.prisma.user.update({
      where: { id },
      data: { suspended: data.status === 'suspended' },
    });
    const { password: _, ...u } = updated;
    return u;
  }

  // ── Institutions ─────────────────────────────────────────────────

  async searchInstitutions(search?: string, pagination: PaginationDto = {}) {
    const { skip = 0, take = 10 } = pagination;
    const where: any = { role: 'institution' as any };
    if (search) {
      where.institution = { contains: search, mode: 'insensitive' };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { institution: 'asc' },
        skip,
        take,
        select: {
          id: true,
          name: true,
          institution: true,
          bio: true,
          profilePicture: true,
          _count: { select: { followers: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    // Deduplicate by institution name, keeping the first user per institution
    const seen = new Set<string>();
    const items = users
      .filter((u) => {
        if (!u.institution || seen.has(u.institution)) return false;
        seen.add(u.institution);
        return true;
      })
      .map((u) => ({
        id: u.id,
        name: u.name,
        institutionName: u.institution,
        bio: u.bio,
        profilePicture: u.profilePicture,
        followerCount: u._count.followers,
      }));

    return { items, total, skip, take };
  }

  async getInstitutions(pagination: PaginationDto = {}) {
    const { skip = 0, take = 10 } = pagination;
    const where = { role: 'institution' as any };
    const [admins, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);

    const instMap: Record<
      string,
      { id: string; name: string; status: string; eventsPublished: number }
    > = {};

    for (const admin of admins) {
      const name = admin.institution ?? 'Unknown';
      if (!instMap[name]) {
        const eventCount = await this.prisma.event.count({
          where: { institution: name, status: 'approved' },
        });
        instMap[name] = {
          id: name,
          name,
          status: admin.suspended ? 'suspended' : 'active',
          eventsPublished: eventCount,
        };
      }
    }

    const items = Object.values(instMap);
    return { items, total, skip, take };
  }

  async suspendInstitution(institutionName: string) {
    await this.prisma.user.updateMany({
      where: { institution: institutionName, role: 'institution' },
      data: { suspended: true },
    });
    return { id: institutionName, name: institutionName, status: 'suspended' };
  }

  async unsuspendInstitution(institutionName: string) {
    await this.prisma.user.updateMany({
      where: { institution: institutionName, role: 'institution' },
      data: { suspended: false },
    });
    return { id: institutionName, name: institutionName, status: 'active' };
  }
}
