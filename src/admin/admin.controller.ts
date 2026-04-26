import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import { UpdateStatusDto } from './dto/update-status.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @UseGuards(JwtAuthGuard)
  @Get('events/pending')
  async getPendingEvents(@CurrentUser() user?: JwtPayload) {
    this.verifySuperAdmin(user);
    return this.adminService.getPendingEvents();
  }

  @UseGuards(JwtAuthGuard)
  @Patch('events/:id/status')
  async updateEventStatus(
    @Param('id') id: string,
    @Body() body: UpdateStatusDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    this.verifySuperAdmin(user);
    return this.adminService.updateEventStatus(id, body);
  }

  // Only super_admin allowed beyond this point
  private verifySuperAdmin(user?: JwtPayload): void {
    if (!user || user.role !== 'super_admin') {
      throw new ForbiddenException(
        'Access denied. Super Admin privileges required.',
      );
    }
  }
}
