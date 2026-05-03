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
import type { UpdateEventDto } from './dto/update-event.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @ApiOperation({ summary: 'Get public approved events' })
  @ApiResponse({ status: 200, description: 'List of events' })
  @Get()
  async getPublicEvents(
    @Query('category') category?: string,
    @Query('city') city?: string,
    @Query('search') search?: string,
  ) {
    return this.eventsService.getPublicEvents({ category, city, search });
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all events (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of institution events' })
  @UseGuards(JwtAuthGuard)
  @Get('all')
  async getAllEvents(
    @Query('institutionId') institutionId?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    this.verifyInstitutionAdmin(user);
    
    // If institution admin, restrict to their own institution
    if (user?.role === 'institution_admin') {
      return this.eventsService.fetchAllEvents(user.institution);
    }
    
    return this.eventsService.fetchAllEvents(institutionId);
  }

  @ApiOperation({ summary: 'Get specific event by ID' })
  @Get(':id')
  async getEventById(@Param('id') id: string) {
    return this.eventsService.getEventById(id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit an event for moderation (pending)' })
  @UseGuards(JwtAuthGuard)
  @Post()
  async submitEvent(
    @Body() createEventDto: CreateEventDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    this.verifyInstitutionAdmin(user);
    const institution = user?.role === 'super_admin' ? (createEventDto.institution || '') : (user?.institution || '');
    if (user?.role === 'institution_admin' && !institution) {
      throw new ForbiddenException('Institution admin must have an institution assigned.');
    }
    return this.eventsService.submitEvent({
      ...createEventDto,
      institution,
    });
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save an event as draft' })
  @UseGuards(JwtAuthGuard)
  @Post('draft')
  async saveDraft(
    @Body() createEventDto: CreateEventDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    this.verifyInstitutionAdmin(user);
    const institution = user?.role === 'super_admin' ? (createEventDto.institution || '') : (user?.institution || '');
    if (user?.role === 'institution_admin' && !institution) {
      throw new ForbiddenException('Institution admin must have an institution assigned.');
    }
    return this.eventsService.saveDraft({
      ...createEventDto,
      institution,
    });
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an owned event' })
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async updateEvent(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    this.verifyInstitutionAdmin(user);
    const institution = user?.role === 'super_admin' ? 'super_admin' : (user?.institution ?? '');
    return this.eventsService.updateEvent(
      id,
      updateEventDto,
      institution,
    );
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an owned draft/rejected event' })
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteEvent(@Param('id') id: string, @CurrentUser() user?: JwtPayload) {
    const role = user?.role ?? 'citizen';
    return this.eventsService.deleteEvent(id, user?.institution ?? '', role);
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

  // ── Security Helpers ──

  private verifyInstitutionAdmin(user?: JwtPayload): void {
    if (
      !user ||
      (user.role !== 'institution_admin' && user.role !== 'super_admin')
    ) {
      throw new ForbiddenException(
        'Only institution admins can perform this action.',
      );
    }
  }

  private getUserId(user?: JwtPayload): string {
    if (!user) throw new ForbiddenException('User session not found.');
    return user.sub;
  }
}
