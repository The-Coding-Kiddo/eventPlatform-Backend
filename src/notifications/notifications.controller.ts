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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({ summary: 'Get targeted notifications for the current user' })
  @Get()
  async getNotifications(@CurrentUser() user?: JwtPayload) {
    if (!user) throw new ForbiddenException('Not authenticated');
    return this.notificationsService.findForUser(
      user.sub,
      user.role,
      user.institution,
    );
  }

  @ApiOperation({ summary: 'Manually dispatch a system broadcast (Super Admin only)' })
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

  @ApiOperation({ summary: 'Mark a single notification as read' })
  @Patch(':id/read')
  async markRead(@Param('id') id: string) {
    return this.notificationsService.markRead(id);
  }

  @ApiOperation({ summary: "Mark all of the user's notifications as read" })
  @Post('read-all')
  async markAllRead(@CurrentUser() user?: JwtPayload) {
    if (!user) throw new ForbiddenException('Not authenticated');
    return this.notificationsService.markAllRead(user.sub, user.role, user.institution);
  }

  @ApiOperation({ summary: 'Delete a notification' })
  @Delete(':id')
  async deleteNotification(@Param('id') id: string) {
    return this.notificationsService.remove(id);
  }
}
