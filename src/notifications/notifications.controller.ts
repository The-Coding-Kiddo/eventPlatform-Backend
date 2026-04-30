import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(@CurrentUser() user?: JwtPayload) {
    if (!user) throw new ForbiddenException('Not authenticated');
    return this.notificationsService.findForUser(
      user.sub,
      user.role,
      user.institution,
    );
  }

  @Post()
  async createNotification(
    @Body() createNotificationDto: CreateNotificationDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    if (!user || user.role !== 'super_admin') {
      throw new ForbiddenException('Only super admins can create system notifications manually');
    }
    return this.notificationsService.create(createNotificationDto);
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string) {
    return this.notificationsService.markRead(id);
  }

  @Post('read-all')
  async markAllRead(@CurrentUser() user?: JwtPayload) {
    if (!user) throw new ForbiddenException('Not authenticated');
    return this.notificationsService.markAllRead(user.sub, user.role);
  }

  @Delete(':id')
  async deleteNotification(@Param('id') id: string) {
    return this.notificationsService.remove(id);
  }
}
