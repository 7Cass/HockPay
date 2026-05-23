import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../infra/database/prisma.module';
import { HealthController } from './health.controller';
import { WorkerHealthService } from './health.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [HealthController],
  providers: [WorkerHealthService],
})
export class HealthModule {}
