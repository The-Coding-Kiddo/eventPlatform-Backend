import { Controller, Post, Get, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { JwtPayload } from './jwt-auth.guard';
import { CurrentUser } from './user.decorator';

interface RegisterDto {
  name: string;
  email: string;
  password: string;
}

interface LoginDto {
  email: string;
  password: string;
}

interface ProvisionDto {
  name: string;
  email: string;
  password: string;
  institution: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body.name, body.email, body.password);
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  /** Restore session — called on page refresh to re-hydrate user state. */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user?: JwtPayload) {
    if (!user) throw new ForbiddenException('Not authenticated');
    return this.authService.getMe(user.sub);
  }

  /** Provision a new institution_admin — super_admin only. */
  @UseGuards(JwtAuthGuard)
  @Post('provision')
  async provision(@Body() body: ProvisionDto, @CurrentUser() user?: JwtPayload) {
    if (!user || user.role !== 'super_admin') {
      throw new ForbiddenException('Super Admin privileges required.');
    }
    return this.authService.provision(
      body.name,
      body.email,
      body.password,
      body.institution,
    );
  }
}
