import { Controller, Post, Delete, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@Controller('registrations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CITIZEN)
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Post(':eventId')
  register(@Param('eventId', ParseIntPipe) eventId: number, @CurrentUser() user: User) {
    return this.registrationsService.register(eventId, user);
  }

  @Delete(':eventId')
  cancel(@Param('eventId', ParseIntPipe) eventId: number, @CurrentUser() user: User) {
    return this.registrationsService.cancel(eventId, user);
  }
}
