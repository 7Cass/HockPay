import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@hockpay/database';

/**
 * PrismaService - Wrapper do PrismaClient para NestJS
 *
 * Esta classe estende o PrismaClient do package @hockpay/database
 * e gerencia o ciclo de vida da conexão com o banco de dados.
 *
 * @Injectable() - Permite injeção de dependência no NestJS
 * OnModuleInit - Conecta ao banco quando o módulo é inicializado
 * OnModuleDestroy - Desconecta ao destruir o módulo
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });
  }

  /**
   * Conecta ao banco de dados quando o módulo é inicializado
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to database');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  /**
   * Desconecta do banco de dados quando o módulo é destruído
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
   * Limpa o banco de dados (apenas para testes)
   */
  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase is only available in test environment');
    }

    // Transactions, raw SQL, etc. would go here if needed
    // Por enquanto, deixamos vazio pois usamos migrations
  }
}
