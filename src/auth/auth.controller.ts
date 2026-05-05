import { Controller, Post, Get, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { JwtPayload } from './jwt-auth.guard';
import { CurrentUser } from './user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ProvisionDto } from './dto/provision.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new citizen account' })
  @ApiResponse({ status: 201, description: 'User successfully registered.' })
  @ApiResponse({ status: 409, description: 'Email already exists.' })
  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body.name, body.email, body.password);
  }

  @ApiOperation({ summary: 'Login and receive JWT' })
  @ApiResponse({ status: 201, description: 'Successfully authenticated.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  /** Restore session — called on page refresh to re-hydrate user state. */
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile (session restore)' })
  @ApiResponse({ status: 200, description: 'User profile returned.' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user?: JwtPayload) {
    if (!user) throw new ForbiddenException('Not authenticated');
    return this.authService.getMe(user.sub);
  }

  /** Provision a new institution_admin — super_admin only. */
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Provision a new institution admin (Super Admin only)' })
  @ApiResponse({ status: 201, description: 'Institution admin created.' })
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
