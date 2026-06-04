import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { InviteAttendeeDto } from './dto/invite-attendee.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { JwtPayload } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuditService } from '../audit/audit.service';


@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly auditService: AuditService,
  ) {}

  @ApiOperation({ summary: 'Get public approved events' })
  @ApiResponse({ status: 200, description: 'List of events' })
  @Get()
  async getPublicEvents(
    @Query() pagination: PaginationDto,
    @Query('category') category?: string,
    @Query('city') city?: string,
    @Query('search') search?: string,
  ) {
    return this.eventsService.getPublicEvents({ category, city, search }, pagination);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all events (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of institution events' })
  @Roles('institution_admin', 'super_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('all')
  async getAllEvents(
    @Query() pagination: PaginationDto,
    @Query('institutionId') institutionId?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    // If institution admin, restrict to their own institution
    if (user?.role === 'institution_admin') {
      return this.eventsService.fetchAllEvents(user.institution, pagination);
    }
    
    return this.eventsService.fetchAllEvents(institutionId, pagination);
  }

  @ApiOperation({ summary: 'Get specific event by ID' })
  @Get(':id')
  async getEventById(@Param('id') id: string) {
    return this.eventsService.getEventById(id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit an event for moderation (pending)' })
  @Roles('institution_admin', 'super_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  async submitEvent(
    @Body() createEventDto: CreateEventDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    const institution = user?.role === 'super_admin' ? (createEventDto.institution || '') : (user?.institution || '');
    if (user?.role === 'institution_admin' && !institution) {
      throw new ForbiddenException('Institution admin must have an institution assigned.');
    }
    const result = await this.eventsService.submitEvent({
      ...createEventDto,
      institution,
    });
    if (user) {
      await this.auditService.log(
        user.sub,
        user.email,
        user.role,
        'SUBMIT_EVENT',
        result.event?.id,
        `Event "${createEventDto.title}" submitted for moderation.`,
      );
    }
    return result;
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save an event as draft' })
  @Roles('institution_admin', 'super_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('draft')
  async saveDraft(
    @Body() createEventDto: CreateEventDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    const institution = user?.role === 'super_admin' ? (createEventDto.institution || '') : (user?.institution || '');
    if (user?.role === 'institution_admin' && !institution) {
      throw new ForbiddenException('Institution admin must have an institution assigned.');
    }
    const result = await this.eventsService.saveDraft({
      ...createEventDto,
      institution,
    });
    if (user) {
      await this.auditService.log(
        user.sub,
        user.email,
        user.role,
        'SAVE_DRAFT',
        result.event?.id,
        `Event "${createEventDto.title}" saved as draft.`,
      );
    }
    return result;
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an owned event' })
  @Roles('institution_admin', 'super_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Put(':id')
  async updateEvent(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    const institution = user?.institution ?? '';
    const result = await this.eventsService.updateEvent(
      id,
      updateEventDto,
      institution,
      user?.role ?? 'citizen',
    );
    if (user) {
      let action = 'UPDATE_EVENT';
      let details = `Event "${result.title}" updated.`;
      if (updateEventDto.status === 'approved') {
        action = 'APPROVE_EVENT';
        details = `Event "${result.title}" approved for publication.`;
      } else if (updateEventDto.status === 'rejected') {
        action = 'REJECT_EVENT';
        details = `Event "${result.title}" rejected.`;
      }
      await this.auditService.log(
        user.sub,
        user.email,
        user.role,
        action,
        id,
        details,
      );
    }
    return result;
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an owned draft/rejected event' })
  @Roles('institution_admin', 'super_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  async deleteEvent(@Param('id') id: string, @CurrentUser() user?: JwtPayload) {
    const role = user?.role ?? 'citizen';
    const result = await this.eventsService.deleteEvent(id, user?.institution ?? '', role);
    if (user) {
      await this.auditService.log(
        user.sub,
        user.email,
        user.role,
        'DELETE_EVENT',
        id,
        `Event ID ${id} deleted.`,
      );
    }
    return result;
  }

  // ── Citizen Endpoints ──

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bookmark an event' })
  @UseGuards(JwtAuthGuard)
  @Post(':id/save')
  async saveEvent(@Param('id') id: string, @CurrentUser() user?: JwtPayload) {
    return this.eventsService.saveEvent(id, this.getUserId(user));
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove bookmark from an event' })
  @UseGuards(JwtAuthGuard)
  @Delete(':id/save')
  async unsaveEvent(@Param('id') id: string, @CurrentUser() user?: JwtPayload) {
    return this.eventsService.unsaveEvent(id, this.getUserId(user));
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register for an event' })
  @UseGuards(JwtAuthGuard)
  @Post(':id/register')
  async registerForEvent(
    @Param('id') id: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.eventsService.registerForEvent(id, this.getUserId(user));
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel event registration' })
  @UseGuards(JwtAuthGuard)
  @Delete(':id/register')
  async cancelRegistration(
    @Param('id') id: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.eventsService.cancelRegistration(id, this.getUserId(user));
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get attendee list for an event (Admin only)' })
  @Roles('institution_admin', 'super_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id/attendees')
  async getAttendees(
    @Param('id') id: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.eventsService.getAttendees(id, user?.institution ?? '', user?.role ?? 'citizen');
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invite a citizen as an attendee of an event (Admin only)' })
  @Roles('institution_admin', 'super_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/invite-attendee')
  async inviteAttendee(
    @Param('id') id: string,
    @Body() inviteAttendeeDto: InviteAttendeeDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    const result = await this.eventsService.inviteAttendee(
      id,
      inviteAttendeeDto.email,
      inviteAttendeeDto.name || '',
      user?.institution ?? '',
      user?.role ?? 'citizen',
    );

    if (user) {
      await this.auditService.log(
        user.sub,
        user.email,
        user.role,
        'INVITE_ATTENDEE',
        id,
        `User ${inviteAttendeeDto.email} invited to event ID ${id} as attendee.`,
      );
    }

    return result;
  }

  private getUserId(user?: JwtPayload): string {
    if (!user) throw new ForbiddenException('User session not found.');
    return user.sub;
  }
}
