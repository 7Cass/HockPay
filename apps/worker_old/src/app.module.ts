import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './infra/database/prisma.module';
import { OutboxProcessor } from './workers/outbox.processor';
import { PaymentExpirationJob, PaymentReleaseJob } from './jobs';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['../../.env', '.env'],
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
  ],
  providers: [
    OutboxProcessor,
    PaymentExpirationJob,
    PaymentReleaseJob,
  ],
})
export class AppModule {}
