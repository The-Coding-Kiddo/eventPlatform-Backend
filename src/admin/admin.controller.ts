import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Post,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UpdateStatusDto } from './dto/update-status.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiTags('Administration')
@ApiBearerAuth()
@Roles('super_admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Moderation ──

  @ApiOperation({ summary: 'Get moderation queue' })
  @Get('moderation')
  async getModerationQueue(
    @Query() pagination: PaginationDto,
    @Query('status') status?: string,
  ) {
    return this.adminService.getModerationQueue(status, pagination);
  }

  @ApiOperation({ summary: 'Approve an event in moderation' })
  @ApiBody({ schema: { type: 'object', properties: { note: { type: 'string' } } } })
  @Post('moderation/:id/approve')
  async approveEvent(
    @Param('id') id: string,
    @Body() body: { note?: string },
  ) {
    return this.adminService.approveEventInQueue(id, body.note);
  }

  @ApiOperation({ summary: 'Reject an event in moderation' })
  @ApiBody({ schema: { type: 'object', properties: { note: { type: 'string' } } } })
  @Post('moderation/:id/reject')
  async rejectEvent(
    @Param('id') id: string,
    @Body() body: { note?: string },
  ) {
    return this.adminService.rejectEventInQueue(id, body.note);
  }

  // ── Analytics ──

  @ApiOperation({ summary: 'Get platform analytics' })
  @Get('analytics')
  async getAnalytics() {
    return this.adminService.getAnalytics();
  }

  // ── Users ──

  @ApiOperation({ summary: 'List all users' })
  @Get('users')
  async getUsers(@Query() pagination: PaginationDto) {
    return this.adminService.getUsers(pagination);
  }

  @ApiOperation({ summary: 'Update a user status (suspend/activate)' })
  @ApiBody({ schema: { type: 'object', properties: { status: { type: 'string', enum: ['active', 'suspended'] } } } })
  @Patch('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: { status: 'active' | 'suspended' },
  ) {
    return this.adminService.updateUser(id, body);
  }

  // ── Institutions ──

  @ApiOperation({ summary: 'List all institutions' })
  @Get('institutions')
  async getInstitutions(@Query() pagination: PaginationDto) {
    return this.adminService.getInstitutions(pagination);
  }

  @ApiOperation({ summary: 'Suspend an institution' })
  @Patch('institutions/:id/suspend')
  async suspendInstitution(
    @Param('id') id: string,
  ) {
    return this.adminService.suspendInstitution(id);
  }

  @ApiOperation({ summary: 'Unsuspend an institution' })
  @Patch('institutions/:id/unsuspend')
  async unsuspendInstitution(
    @Param('id') id: string,
  ) {
    return this.adminService.unsuspendInstitution(id);
  }

  // ── Legacy / Fallback ──

  @ApiOperation({ summary: 'Legacy: Update event status directly' })
  @Patch('events/:id/status')
  async updateEventStatus(
    @Param('id') id: string,
    @Body() body: UpdateStatusDto,
  ) {
    return this.adminService.updateEventStatus(id, body);
  }
}
