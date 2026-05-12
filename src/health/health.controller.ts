import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  /**
   * GET /health
   * Checks:
   *   1. database — Prisma can reach PostgreSQL
   *   2. memory_heap — heap usage is under 300 MB
   *
   * Returns 200 OK when all checks pass, 503 when any fail.
   * Used by Docker / Kubernetes liveness & readiness probes.
   */
  @ApiOperation({ summary: 'Liveness & readiness health probe' })
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024), // 300 MB ceiling
    ]);
  }
}
