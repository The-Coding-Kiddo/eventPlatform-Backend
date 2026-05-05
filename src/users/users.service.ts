import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}
