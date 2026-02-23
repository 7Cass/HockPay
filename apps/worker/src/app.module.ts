import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './infra/database/prisma.module';
import { CoreModule } from './modules/core/core.module';
import { QueueModule } from './modules/queue/queue.module';
import { CronModule } from './modules/queue/cron.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['../../.env', '.env'],
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CoreModule,
    QueueModule,
    CronModule,
  ],
  providers: [],
})
export class AppModule {}
