import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../../infra/database/prisma.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private prismaIndicator: PrismaHealthIndicator,
    private db: PrismaService,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024), // 150MB
      () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024), // 150MB
      () => this.prismaIndicator.pingCheck('database', this.db),
    ]);
  }

  @Get('ready')
  @Public()
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('database', this.db),
    ]);
  }

  @Get('live')
  @Public()
  liveness() {
    return { status: 'ok' };
  }
}
