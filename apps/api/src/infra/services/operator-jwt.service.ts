import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  IOperatorJwtServicePort,
  OperatorJwtPayload,
  TOKEN_AUDIENCE,
} from '@hockpay/core';

/**
 * Infrastructure implementation of IOperatorJwtServicePort.
 *
 * It uses a secret of its own (`OPERATOR_JWT_SECRET`), so a merchant token
 * does not verify here even if some guard forgets to check the audience --
 * and an operator token does not verify on the merchant side either.
 *
 * Like JWT_SECRET, a missing secret fails at boot. There is no fallback to the
 * merchant secret: a silent fallback would erase the whole point.
 */
@Injectable()
export class OperatorJwtService implements IOperatorJwtServicePort {
  private readonly nestJwtService: NestJwtService;

  constructor(private readonly config: ConfigService) {
    const secret = this.config.get<string>('OPERATOR_JWT_SECRET');
    if (!secret) {
      throw new Error('OPERATOR_JWT_SECRET environment variable is required');
    }
    this.nestJwtService = new NestJwtService({
      secret,
      signOptions: {
        algorithm: 'HS256',
        audience: TOKEN_AUDIENCE.OPERATOR,
      },
      verifyOptions: {
        audience: TOKEN_AUDIENCE.OPERATOR,
      },
    });
  }

  async generateAccessToken(
    sub: string,
    expiresIn: string = '15m',
  ): Promise<string> {
    return this.nestJwtService.signAsync({ sub }, { expiresIn } as Record<
      string,
      unknown
    >);
  }

  async verifyToken(token: string): Promise<OperatorJwtPayload> {
    try {
      return await this.nestJwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
