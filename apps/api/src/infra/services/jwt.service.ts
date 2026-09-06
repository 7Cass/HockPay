import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IJwtServicePort, JwtPayload, TOKEN_AUDIENCE } from '@hockpay/core';

/**
 * Infrastructure implementation of IJwtServicePort for the merchant principal.
 *
 * This service wraps NestJS JwtService to provide JWT operations.
 * Configuration is loaded from environment variables.
 *
 * Every token it signs carries the merchant audience, and verification rejects
 * any other audience before the payload is read.
 */
@Injectable()
export class JwtService implements IJwtServicePort {
  private readonly nestJwtService: NestJwtService;

  constructor(private readonly config: ConfigService) {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    this.nestJwtService = new NestJwtService({
      secret,
      signOptions: {
        algorithm: 'HS256',
        audience: TOKEN_AUDIENCE.MERCHANT,
      },
      verifyOptions: {
        audience: TOKEN_AUDIENCE.MERCHANT,
      },
    });
  }

  async generateAccessToken(
    sub: string,
    storeId: string | null,
    expiresIn: string = '15m',
  ): Promise<string> {
    const payload: Omit<JwtPayload, 'aud'> = { sub };
    if (storeId) {
      payload.storeId = storeId;
    }
    return this.nestJwtService.signAsync(payload, { expiresIn } as Record<
      string,
      unknown
    >);
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      return await this.nestJwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  decodeToken(token: string): JwtPayload | null {
    try {
      return this.nestJwtService.decode(token);
    } catch {
      return null;
    }
  }
}
