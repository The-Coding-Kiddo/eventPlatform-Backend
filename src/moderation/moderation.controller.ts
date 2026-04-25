import { Controller, Get, Patch, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  // GET /moderation/queue — pending events
  @Get('queue')
  getQueue() {
    return this.moderationService.getQueue();
  }

  // PATCH /moderation/:id/approve
  @Patch(':id/approve')
  approve(@Param('id', ParseIntPipe) id: number) {
    return this.moderationService.approve(id);
  }

  // PATCH /moderation/:id/reject
  @Patch(':id/reject')
  reject(@Param('id', ParseIntPipe) id: number) {
    return this.moderationService.reject(id);
  }
}
