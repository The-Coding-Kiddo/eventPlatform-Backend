import {
  Controller,
  Put,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import { UpdateSubscriptionsDto } from '../events/dto/update-subscriptions.dto';

@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Put('subscriptions')
  async updateSubscriptions(
    @Body() body: UpdateSubscriptionsDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    if (!user) {
      throw new ForbiddenException('User session not found.');
    }
    return this.usersService.updateSubscriptions(user.sub, body.categories);
  }
}
