import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async updateSubscriptions(userId: string, categories: string[]) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { subscriptions: categories },
    });
    return { subscriptions: categories };
  }

  async updateProfile(userId: string, data: { name?: string }) {
    if (!data.name || !data.name.trim()) {
      throw new BadRequestException('Name cannot be empty');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { name: data.name.trim() },
      select: { id: true, name: true, email: true, role: true, institution: true },
    });
    return { message: 'Profile updated successfully', user: updated };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('New password must be at least 6 characters');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });
    return { message: 'Password changed successfully' };
  }
}

