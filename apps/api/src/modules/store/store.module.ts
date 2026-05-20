import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StoreController } from './store.controller';
import { CreateStoreUseCase, IUnitOfWork, ListStoresUseCase } from '@hockpay/core';
import { StoreRepository, UnitOfWork } from '@hockpay/infrastructure';
import { JwtService } from 'src/infra/services/jwt.service';
import { TokenGeneratorService } from 'src/infra/services/token-generator.service';
import { SlugGeneratorService } from 'src/infra/services/slug-generator.service';
import { PrismaService } from 'src/infra/database/prisma.service';
import { AuthModule } from '../auth/auth.module';

/**
 * Store Module
 *
 * This module provides store-related endpoints and dependencies.
 * Use cases from the core layer are instantiated here with their dependencies.
 */
@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [StoreController],
  providers: [
    // Infrastructure
    PrismaService,
    {
      provide: StoreRepository,
      useFactory: (prisma: PrismaService) => new StoreRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IUnitOfWork',
      useFactory: (prisma: PrismaService) => new UnitOfWork(prisma),
      inject: [PrismaService],
    },
    JwtService,
    TokenGeneratorService,
    SlugGeneratorService,

    // Use Cases (from core)
    {
      provide: CreateStoreUseCase,
      useFactory: (
        unitOfWork: IUnitOfWork,
        jwtService: JwtService,
        tokenGenerator: TokenGeneratorService,
        slugGenerator: SlugGeneratorService,
      ) => {
        return new CreateStoreUseCase(
          unitOfWork,
          jwtService,
          tokenGenerator,
          slugGenerator,
        );
      },
      inject: [
        'IUnitOfWork',
        JwtService,
        TokenGeneratorService,
        SlugGeneratorService,
      ],
    },
    {
      provide: ListStoresUseCase,
      useFactory: (storeRepo: StoreRepository) => {
        return new ListStoresUseCase(storeRepo);
      },
      inject: [StoreRepository],
    },
  ],
  exports: [CreateStoreUseCase, ListStoresUseCase],
})
export class StoreModule {}
