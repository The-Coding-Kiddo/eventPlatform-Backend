import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(name: string, email: string, password: string) {
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('An account with this email already exists.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { name, email, password: hashedPassword, role: 'citizen' },
    });

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword };
  }

  async login(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        savedEvents: { select: { id: true } },
        registeredEvents: { select: { id: true } },
      },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(pass, user.password);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

    // Include institution in JWT so controllers can use it without a DB lookup
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      institution: user.institution ?? undefined,
    };
    const token = await this.jwtService.signAsync(payload);

    const {
      password: _,
      savedEvents,
      registeredEvents,
      ...userWithoutPassword
    } = user;

    return {
      token,
      user: {
        ...userWithoutPassword,
        savedEvents: savedEvents.map((e) => e.id),
        registeredEvents: registeredEvents.map((e) => e.id),
      },
    };
  }

  /** Restore session — returns full user object from DB using the JWT sub. */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        savedEvents: { select: { id: true } },
        registeredEvents: { select: { id: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const { password: _, savedEvents, registeredEvents, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      savedEvents: savedEvents.map((e) => e.id),
      registeredEvents: registeredEvents.map((e) => e.id),
    };
  }

  /**
   * Provision a new institution_admin account.
   * Only callable by super_admin (enforced in controller).
   */
  async provision(
    name: string,
    email: string,
    password: string,
    institution: string,
  ) {
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('An account with this email already exists.');
    }

    if (!institution?.trim()) {
      throw new ForbiddenException('Institution name is required.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'institution_admin',
        institution,
      },
    });

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword };
  }
}
