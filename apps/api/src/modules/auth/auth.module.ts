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
import { RefreshTokenRepository } from '@hockpay/infrastructure';
import { PasswordHasherService } from 'src/infra/services/password-hasher.service';
import { JwtService } from 'src/infra/services/jwt.service';
import { TokenGeneratorService } from 'src/infra/services/token-generator.service';
import { provideUseCase } from 'src/common/provide-use-case';

/**
 * Auth Module
 *
 * This module provides authentication-related endpoints and dependencies.
 * Use cases from the core layer are instantiated here with their dependencies.
 *
 * Repositorios, UnitOfWork, JwtService e TokenGeneratorService vem do
 * InfrastructureModule global.
 */
@Module({
  imports: [ConfigModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    JwtAuthGuard,
    RequireStoreGuard,
    PasswordHasherService,

    provideUseCase(LoginUseCase, [
      'IUnitOfWork',
      PasswordHasherService,
      JwtService,
      TokenGeneratorService,
    ]),
    provideUseCase(RefreshTokenUseCase, [
      'IUnitOfWork',
      JwtService,
      TokenGeneratorService,
    ]),
    provideUseCase(LogoutUseCase, [RefreshTokenRepository]),
    provideUseCase(SwitchStoreUseCase, [
      'IUnitOfWork',
      JwtService,
      TokenGeneratorService,
    ]),
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
