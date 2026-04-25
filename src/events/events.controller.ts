import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/user.decorator';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

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
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.role !== 'institution_admin' && user.role !== 'super_admin') {
      throw new Error('Only institution admins can publish events.');
    }

    return this.eventsService.submitEvent(createEventDto);
  }
}
