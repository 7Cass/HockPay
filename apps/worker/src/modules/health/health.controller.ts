import { Controller, Get } from '@nestjs/common';
import { WorkerHealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: WorkerHealthService) {}

  @Get('live')
  liveness() {
    return { status: 'ok' };
  }

  @Get('ready')
  readiness() {
    return this.health.readiness();
  }
}
