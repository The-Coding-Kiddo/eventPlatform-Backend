import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  ForbiddenException,
  Post,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import { UpdateStatusDto } from './dto/update-status.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Moderation ──

  @Get('moderation')
  async getModerationQueue(
    @Query('status') status?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    this.verifySuperAdmin(user);
    return this.adminService.getModerationQueue(status);
  }

  @Post('moderation/:id/approve')
  async approveEvent(
    @Param('id') id: string,
    @Body() body: { note?: string },
    @CurrentUser() user?: JwtPayload,
  ) {
    this.verifySuperAdmin(user);
    return this.adminService.approveEventInQueue(id, body.note);
  }

  @Post('moderation/:id/reject')
  async rejectEvent(
    @Param('id') id: string,
    @Body() body: { note?: string },
    @CurrentUser() user?: JwtPayload,
  ) {
    this.verifySuperAdmin(user);
    return this.adminService.rejectEventInQueue(id, body.note);
  }

  // ── Analytics ──

  @Get('analytics')
  async getAnalytics(@CurrentUser() user?: JwtPayload) {
    this.verifySuperAdmin(user);
    return this.adminService.getAnalytics();
  }

  // ── Users ──

  @Get('users')
  async getUsers(@CurrentUser() user?: JwtPayload) {
    this.verifySuperAdmin(user);
    return this.adminService.getUsers();
  }

  // ── Institutions ──

  @Get('institutions')
  async getInstitutions(@CurrentUser() user?: JwtPayload) {
    this.verifySuperAdmin(user);
    return this.adminService.getInstitutions();
  }

  @Patch('institutions/:id/suspend')
  async suspendInstitution(
    @Param('id') id: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    this.verifySuperAdmin(user);
    return this.adminService.suspendInstitution(id);
  }

  @Patch('institutions/:id/unsuspend')
  async unsuspendInstitution(
    @Param('id') id: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    this.verifySuperAdmin(user);
    return this.adminService.unsuspendInstitution(id);
  }

  // ── Legacy / Fallback ──

  @Get('events/pending')
  async getPendingEvents(@CurrentUser() user?: JwtPayload) {
    this.verifySuperAdmin(user);
    return this.adminService.getPendingEvents();
  }

  @Patch('events/:id/status')
  async updateEventStatus(
    @Param('id') id: string,
    @Body() body: UpdateStatusDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    this.verifySuperAdmin(user);
    return this.adminService.updateEventStatus(id, body);
  }

  private verifySuperAdmin(user?: JwtPayload): void {
    if (!user || user.role !== 'super_admin') {
      throw new ForbiddenException(
        'Access denied. Super Admin privileges required.',
      );
    }
  }
}
