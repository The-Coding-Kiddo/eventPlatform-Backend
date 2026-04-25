import { Controller, Get, Patch, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // GET /notifications — full list for current user
  @Get()
  findAll(@CurrentUser() user: User) {
    return this.notificationsService.findAll(user);
  }

  // PATCH /notifications/read-all — mark all as read
  @Patch('read-all')
  markAllRead(@CurrentUser() user: User) {
    return this.notificationsService.markAllRead(user);
  }

  // PATCH /notifications/:id/read — mark one as read
  @Patch(':id/read')
  markOneRead(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.notificationsService.markOneRead(id, user);
  }
}
