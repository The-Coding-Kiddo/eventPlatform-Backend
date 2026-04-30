import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateStatusDto } from './dto/update-status.dto';

@Injectable()
export class AdminService {
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

  async getModerationQueue(status?: string) {
    // Map frontend status names → DB event statuses
    const statusMap: Record<string, string> = {
      pending_review: 'pending',
      pending: 'pending',
      approved: 'approved',
      rejected: 'rejected',
    };
    const dbStatus = status ? statusMap[status] ?? status : undefined;

    const events = await this.prisma.event.findMany({
      where: dbStatus ? { status: dbStatus as any } : { status: { not: 'draft' } },
      orderBy: { createdAt: 'desc' },
    });

    // Map events to queue item shape
    return events.map((e) => ({
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
    const [events, users] = await Promise.all([
      this.prisma.event.findMany(),
      this.prisma.user.findMany({ where: { role: { not: 'super_admin' } } }),
    ]);

    const total    = events.length;
    const pending  = events.filter((e) => e.status === 'pending').length;
    const approved = events.filter((e) => e.status === 'approved').length;
    const rejected = events.filter((e) => e.status === 'rejected').length;
    const reviewed = approved + rejected;

    const institutions = new Set(
      users
        .filter((u) => u.role === 'institution_admin' && u.institution)
        .map((u) => u.institution),
    );

    // Category distribution
    const catMap: Record<string, number> = {};
    events.forEach((e) => { catMap[e.category] = (catMap[e.category] ?? 0) + 1; });
    const categoryDistribution = Object.entries(catMap).map(([name, value]) => ({ name, value }));

    // Top cities
    const cityMap: Record<string, number> = {};
    events.forEach((e) => { cityMap[e.location] = (cityMap[e.location] ?? 0) + 1; });
    const topCities = Object.entries(cityMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([city, count]) => ({ city, count }));

    return {
      totalEvents: total,
      pendingModeration: pending,
      approvedEvents: approved,
      rejectedEvents: rejected,
      approvalRate: reviewed ? Math.round((approved / reviewed) * 100) : 0,
      avgRiskScore: 0,
      totalInstitutions: institutions.size,
      activeInstitutions: institutions.size,
      totalUsers: users.filter((u) => u.role === 'citizen').length,
      eventsThisMonth: events.filter((e) => {
        const d = new Date(e.createdAt);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length,
      monthlyEvents: [],
      categoryDistribution,
      topCities,
      recentActivity: [],
    };
  }

  // ── Users ────────────────────────────────────────────────────────

  async getUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return users.map(({ password: _, ...u }) => u);
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

  async getInstitutions() {
    const admins = await this.prisma.user.findMany({
      where: { role: 'institution_admin' },
    });

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

    return Object.values(instMap);
  }

  async suspendInstitution(institutionName: string) {
    await this.prisma.user.updateMany({
      where: { institution: institutionName, role: 'institution_admin' },
      data: { suspended: true },
    });
    return { id: institutionName, name: institutionName, status: 'suspended' };
  }

  async unsuspendInstitution(institutionName: string) {
    await this.prisma.user.updateMany({
      where: { institution: institutionName, role: 'institution_admin' },
      data: { suspended: false },
    });
    return { id: institutionName, name: institutionName, status: 'active' };
  }
}
