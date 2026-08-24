import { PrismaClient, Prisma } from './generated/prisma';

/**
 * Cria uma nova instância do PrismaClient.
 *
 * Esta função é agnóstica de framework e pode ser usada em qualquer contexto.
 * Para NestJS, use o PrismaService que estende esta classe e gerencia o lifecycle.
 *
 * @param options - Opções do PrismaClient
 * @returns Instância do PrismaClient
 */
export function createPrismaClient(
  options?: ConstructorParameters<typeof PrismaClient>[0],
): PrismaClient {
  return new PrismaClient(options);
}

// Exporta o PrismaClient puro para uso direto
export { PrismaClient, Prisma };

// Re-exporta todos os tipos e enums do Prisma
export * from './generated/prisma';
