import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * PrismaModule - Módulo do Prisma para NestJS
 *
 * @Global() - Torna o módulo disponível globalmente sem precisar importar
 * em outros módulos. O PrismaService pode ser injetado em qualquer lugar.
 *
 * Este módulo é responsável por fornecer uma única instância do PrismaService
 * para toda a aplicação, gerenciando a conexão com o banco de dados.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
