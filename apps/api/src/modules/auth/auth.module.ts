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
  IUnitOfWork,
} from '@hockpay/core';
import {
  MerchantRepository,
  RefreshTokenRepository,
  UnitOfWork,
} from '@hockpay/infrastructure';
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
    {
      provide: MerchantRepository,
      useFactory: (prisma: PrismaService) => new MerchantRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: RefreshTokenRepository,
      useFactory: (prisma: PrismaService) => new RefreshTokenRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IUnitOfWork',
      useFactory: (prisma: PrismaService) => new UnitOfWork(prisma),
      inject: [PrismaService],
    },
    PasswordHasherService,
    JwtService,
    TokenGeneratorService,

    // Use Cases (from core)
    {
      provide: LoginUseCase,
      useFactory: (
        unitOfWork: IUnitOfWork,
        passwordHasher: PasswordHasherService,
        jwtService: JwtService,
        tokenGenerator: TokenGeneratorService,
      ) => {
        return new LoginUseCase(
          unitOfWork,
          passwordHasher,
          jwtService,
          tokenGenerator,
        );
      },
      inject: [
        'IUnitOfWork',
        PasswordHasherService,
        JwtService,
        TokenGeneratorService,
      ],
    },
    {
      provide: RefreshTokenUseCase,
      useFactory: (
        unitOfWork: IUnitOfWork,
        jwtService: JwtService,
        tokenGenerator: TokenGeneratorService,
      ) => {
        return new RefreshTokenUseCase(
          unitOfWork,
          jwtService,
          tokenGenerator,
        );
      },
      inject: [
        'IUnitOfWork',
        JwtService,
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
        unitOfWork: IUnitOfWork,
        jwtService: JwtService,
        tokenGenerator: TokenGeneratorService,
      ) => {
        return new SwitchStoreUseCase(
          unitOfWork,
          jwtService,
          tokenGenerator,
        );
      },
      inject: [
        'IUnitOfWork',
        JwtService,
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
