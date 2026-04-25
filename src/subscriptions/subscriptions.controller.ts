import { Controller, Post, Delete, Param, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CITIZEN)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post(':category')
  subscribe(@Param('category') category: string, @CurrentUser() user: User) {
    return this.subscriptionsService.subscribe(category, user);
  }

  @Delete(':category')
  unsubscribe(@Param('category') category: string, @CurrentUser() user: User) {
    return this.subscriptionsService.unsubscribe(category, user);
  }
}
