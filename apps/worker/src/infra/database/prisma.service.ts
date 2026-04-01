import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@hockpay/database';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'query'>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to database');

      const isDev = this.configService.get<string>('NODE_ENV') !== 'production';

      this.$on('query', (e: Prisma.QueryEvent) => {
        if (isDev) {
          this.logger.debug(`Query: ${e.query} - Params: ${e.params} - Duration: ${e.duration}ms`);
        } else if (e.duration >= 200) {
          this.logger.warn(`Slow query detected (${e.duration}ms): ${e.query}`);
        }
      });
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
      this.logger.log('Successfully disconnected from database');
    } catch (error) {
      this.logger.error('Error disconnecting from database', error);
    }
  }

  async cleanDatabase(): Promise<void> {
    if (this.configService.get<string>('NODE_ENV') !== 'test') {
      throw new Error('cleanDatabase is only available in test environment');
    }
  }
}
