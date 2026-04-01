import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
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
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get<string>('NODE_ENV') === 'production';
        return {
          pinoHttp: {
            level: isProd ? 'info' : 'debug',
            transport: isProd ? undefined : { target: 'pino-pretty' },
            customProps: (req, res) => ({
              context: 'WORKER',
            }),
          },
        };
      },
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
