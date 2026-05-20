import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RequireStoreGuard } from './guards/require-store.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import {
  LoginUseCase,
  RefreshTokenUseCase,
  LogoutUseCase,
  SwitchStoreUseCase,
} from '@hockpay/core';
import { StoreRepository } from '@hockpay/infrastructure';
import { MerchantRepository } from 'src/infra/repositories/merchant.repository.impl';
import { RefreshTokenRepository } from 'src/infra/repositories/refresh-token.repository.impl';
import { PasswordHasherService } from 'src/infra/services/password-hasher.service';
import { JwtService } from 'src/infra/services/jwt.service';
import { TokenGeneratorService } from 'src/infra/services/token-generator.service';
import { PrismaService } from 'src/infra/database/prisma.service';

/**
 * Auth Module
 *
 * This module provides authentication-related endpoints and dependencies.
 * Use cases from the core layer are instantiated here with their dependencies.
 */
@Module({
  imports: [ConfigModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [AuthController],
  providers: [
    // Strategies
    JwtStrategy,

    // Guards
    JwtAuthGuard,
    RequireStoreGuard,

    // Infrastructure
    PrismaService,
    MerchantRepository,
    RefreshTokenRepository,
    {
      provide: StoreRepository,
      useFactory: (prisma: PrismaService) => new StoreRepository(prisma),
      inject: [PrismaService],
    },
    PasswordHasherService,
    JwtService,
    TokenGeneratorService,

    // Use Cases (from core)
    {
      provide: LoginUseCase,
      useFactory: (
        merchantRepo: MerchantRepository,
        passwordHasher: PasswordHasherService,
        jwtService: JwtService,
        refreshTokenRepo: RefreshTokenRepository,
        tokenGenerator: TokenGeneratorService,
      ) => {
        return new LoginUseCase(
          merchantRepo,
          passwordHasher,
          jwtService,
          refreshTokenRepo,
          tokenGenerator,
        );
      },
      inject: [
        MerchantRepository,
        PasswordHasherService,
        JwtService,
        RefreshTokenRepository,
        TokenGeneratorService,
      ],
    },
    {
      provide: RefreshTokenUseCase,
      useFactory: (
        merchantRepo: MerchantRepository,
        jwtService: JwtService,
        refreshTokenRepo: RefreshTokenRepository,
        tokenGenerator: TokenGeneratorService,
      ) => {
        return new RefreshTokenUseCase(
          merchantRepo,
          jwtService,
          refreshTokenRepo,
          tokenGenerator,
        );
      },
      inject: [
        MerchantRepository,
        JwtService,
        RefreshTokenRepository,
        TokenGeneratorService,
      ],
    },
    {
      provide: LogoutUseCase,
      useFactory: (refreshTokenRepo: RefreshTokenRepository) => {
        return new LogoutUseCase(refreshTokenRepo);
      },
      inject: [RefreshTokenRepository],
    },
    {
      provide: SwitchStoreUseCase,
      useFactory: (
        storeRepo: StoreRepository,
        merchantRepo: MerchantRepository,
        jwtService: JwtService,
        refreshTokenRepo: RefreshTokenRepository,
        tokenGenerator: TokenGeneratorService,
      ) => {
        return new SwitchStoreUseCase(
          storeRepo,
          merchantRepo,
          jwtService,
          refreshTokenRepo,
          tokenGenerator,
        );
      },
      inject: [
        StoreRepository,
        MerchantRepository,
        JwtService,
        RefreshTokenRepository,
        TokenGeneratorService,
      ],
    },
  ],
  exports: [
    LoginUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    SwitchStoreUseCase,
    JwtAuthGuard,
    RequireStoreGuard,
  ],
})
export class AuthModule {}
