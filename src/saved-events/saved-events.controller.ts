import { Controller, Post, Delete, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { SavedEventsService } from './saved-events.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@Controller('saved-events')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CITIZEN)
export class SavedEventsController {
  constructor(private readonly savedEventsService: SavedEventsService) {}

  @Post(':eventId')
  save(@Param('eventId', ParseIntPipe) eventId: number, @CurrentUser() user: User) {
    return this.savedEventsService.save(eventId, user);
  }

  @Delete(':eventId')
  unsave(@Param('eventId', ParseIntPipe) eventId: number, @CurrentUser() user: User) {
    return this.savedEventsService.unsave(eventId, user);
  }
}
