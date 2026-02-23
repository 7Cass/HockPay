import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import {
  LoginUseCase,
  RefreshTokenUseCase,
  LogoutUseCase,
  LogoutAllUseCase,
} from '@hockpay/core';
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
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [
    // Infrastructure
    PrismaService,
    MerchantRepository,
    RefreshTokenRepository,
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
      provide: LogoutAllUseCase,
      useFactory: (refreshTokenRepo: RefreshTokenRepository) => {
        return new LogoutAllUseCase(refreshTokenRepo);
      },
      inject: [RefreshTokenRepository],
    },
  ],
  exports: [
    LoginUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    LogoutAllUseCase,
  ],
})
export class AuthModule {}
