import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * PrismaModule - Prisma module for NestJS
 *
 * @Global() - Makes the module globally available without needing to import
 * in other modules. The PrismaService can be injected anywhere.
 *
 * This module is responsible for providing a single instance of PrismaService
 * for the entire application, managing the database connection.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
