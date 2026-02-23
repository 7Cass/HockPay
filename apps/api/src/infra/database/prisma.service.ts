import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@hockpay/database';
import { ConfigService } from '@nestjs/config';

/**
 * PrismaService - PrismaClient wrapper for NestJS
 *
 * This class extends the PrismaClient from the @hockpay/database package
 * and manages the database connection lifecycle.
 *
 * @Injectable() - Allows for dependency injection in NestJS
 * OnModuleInit - Connects to the database when the module is initialized
 * OnModuleDestroy - Disconnects when the module is destroyed
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    super({
      log:
        configService.get<string>('NODE_ENV') === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });
  }

  /**
   * Connects to the database when the module is initialized
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to database');
    } catch (error) {
      console.log('teste');
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  /**
   * Disconnects from the database when the module is destroyed
   */
  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
      this.logger.log('Successfully disconnected from database');
    } catch (error) {
      this.logger.error('Error disconnecting from database', error);
    }
  }

  /**
   * Clean the database (only for testing)
   */
  async cleanDatabase(): Promise<void> {
    if (this.configService.get<string>('NODE_ENV') !== 'test') {
      throw new Error('cleanDatabase is only available in test environment');
    }

    // Transactions, raw SQL, etc. would go here if needed
    // For now, we leave it empty as we use migrations
  }
}
