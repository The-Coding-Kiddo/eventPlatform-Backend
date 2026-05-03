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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiTags('Administration')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Moderation ──

  @ApiOperation({ summary: 'Get moderation queue' })
  @Get('moderation')
  async getModerationQueue(
    @Query('status') status?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    this.verifySuperAdmin(user);
    return this.adminService.getModerationQueue(status);
  }

  @ApiOperation({ summary: 'Approve an event in moderation' })
  @ApiBody({ schema: { type: 'object', properties: { note: { type: 'string' } } } })
  @Post('moderation/:id/approve')
  async approveEvent(
    @Param('id') id: string,
    @Body() body: { note?: string },
    @CurrentUser() user?: JwtPayload,
  ) {
    this.verifySuperAdmin(user);
    return this.adminService.approveEventInQueue(id, body.note);
  }

  @ApiOperation({ summary: 'Reject an event in moderation' })
  @ApiBody({ schema: { type: 'object', properties: { note: { type: 'string' } } } })
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

  @ApiOperation({ summary: 'Get platform analytics' })
  @Get('analytics')
  async getAnalytics(@CurrentUser() user?: JwtPayload) {
    this.verifySuperAdmin(user);
    return this.adminService.getAnalytics();
  }

  // ── Users ──

  @ApiOperation({ summary: 'List all users' })
  @Get('users')
  async getUsers(@CurrentUser() user?: JwtPayload) {
    this.verifySuperAdmin(user);
    return this.adminService.getUsers();
  }

  @ApiOperation({ summary: 'Update a user status (suspend/activate)' })
  @ApiBody({ schema: { type: 'object', properties: { status: { type: 'string', enum: ['active', 'suspended'] } } } })
  @Patch('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: { status: 'active' | 'suspended' },
    @CurrentUser() user?: JwtPayload,
  ) {
    this.verifySuperAdmin(user);
    return this.adminService.updateUser(id, body);
  }

  // ── Institutions ──

  @ApiOperation({ summary: 'List all institutions' })
  @Get('institutions')
  async getInstitutions(@CurrentUser() user?: JwtPayload) {
    this.verifySuperAdmin(user);
    return this.adminService.getInstitutions();
  }

  @ApiOperation({ summary: 'Suspend an institution' })
  @Patch('institutions/:id/suspend')
  async suspendInstitution(
    @Param('id') id: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    this.verifySuperAdmin(user);
    return this.adminService.suspendInstitution(id);
  }

  @ApiOperation({ summary: 'Unsuspend an institution' })
  @Patch('institutions/:id/unsuspend')
  async unsuspendInstitution(
    @Param('id') id: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    this.verifySuperAdmin(user);
    return this.adminService.unsuspendInstitution(id);
  }

  // ── Legacy / Fallback ──

  @ApiOperation({ summary: 'Legacy: Get pending events directly' })
  @Get('events/pending')
  async getPendingEvents(@CurrentUser() user?: JwtPayload) {
    this.verifySuperAdmin(user);
    return this.adminService.getPendingEvents();
  }

  @ApiOperation({ summary: 'Legacy: Update event status directly' })
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
