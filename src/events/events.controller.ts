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
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import type { UpdateEventDto } from './dto/update-event.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/user.decorator';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async getPublicEvents() {
    return this.eventsService.getPublicEvents();
  }

  @Get(':id')
  async getEventById(@Param('id') id: string) {
    return this.eventsService.getEventById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async submitEvent(
    @Body() createEventDto: CreateEventDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    this.verifyInstitutionAdmin(user);
    return this.eventsService.submitEvent({
      ...createEventDto,
      institution: user?.institution ?? '',
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('draft')
  async saveDraft(
    @Body() createEventDto: CreateEventDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    this.verifyInstitutionAdmin(user);
    return this.eventsService.saveDraft({
      ...createEventDto,
      institution: user?.institution ?? '',
    });
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async updateEvent(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    this.verifyInstitutionAdmin(user);
    return this.eventsService.updateEvent(
      id,
      updateEventDto,
      user?.institution ?? '',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteEvent(@Param('id') id: string, @CurrentUser() user?: JwtPayload) {
    const role = user?.role ?? 'citizen';
    return this.eventsService.deleteEvent(id, user?.institution ?? '', role);
  }

  // ── Phase 4: Citizen Endpoints ──

  @UseGuards(JwtAuthGuard)
  @Post(':id/save')
  async saveEvent(@Param('id') id: string, @CurrentUser() user?: JwtPayload) {
    return this.eventsService.saveEvent(id, this.getUserId(user));
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/save')
  async unsaveEvent(@Param('id') id: string, @CurrentUser() user?: JwtPayload) {
    return this.eventsService.unsaveEvent(id, this.getUserId(user));
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/register')
  async registerForEvent(
    @Param('id') id: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.eventsService.registerForEvent(id, this.getUserId(user));
  }

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
