import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    userId: string,
    userEmail: string,
    userRole: string,
    action: string,
    targetId?: string,
    details?: string,
  ) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          userId,
          userEmail,
          userRole,
          action,
          targetId,
          details,
        },
      });
    } catch (error) {
      console.error('FAILED TO WRITE AUDIT LOG:', error);
    }
  }
}
