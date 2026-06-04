import {
  Controller,
  Put,
  Patch,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import { UpdateSubscriptionsDto } from '../events/dto/update-subscriptions.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Update citizen category subscriptions' })
  @UseGuards(JwtAuthGuard)
  @Put('subscriptions')
  async updateSubscriptions(
    @Body() body: UpdateSubscriptionsDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    if (!user) throw new ForbiddenException('User session not found.');
    return this.usersService.updateSubscriptions(user.sub, body.categories);
  }

  @ApiOperation({ summary: 'Update own profile (name)' })
  @ApiBody({ schema: { example: { name: 'Jane Doe' } } })
  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(
    @Body() body: { name: string },
    @CurrentUser() user?: JwtPayload,
  ) {
    if (!user) throw new ForbiddenException('User session not found.');
    return this.usersService.updateProfile(user.sub, { name: body.name });
  }

  @ApiOperation({ summary: 'Change own password' })
  @ApiBody({ schema: { example: { currentPassword: 'old', newPassword: 'new123' } } })
  @UseGuards(JwtAuthGuard)
  @Patch('password')
  async changePassword(
    @Body() body: { currentPassword: string; newPassword: string },
    @CurrentUser() user?: JwtPayload,
  ) {
    if (!user) throw new ForbiddenException('User session not found.');
    return this.usersService.changePassword(
      user.sub,
      body.currentPassword,
      body.newPassword,
    );
  }
}

