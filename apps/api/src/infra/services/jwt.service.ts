import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IJwtServicePort, JwtPayload } from '@hockpay/core';

/**
 * Infrastructure implementation of IJwtServicePort.
 *
 * This service wraps NestJS JwtService to provide JWT operations.
 * Configuration is loaded from environment variables.
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
      },
    });
  }

  async generateAccessToken(
    sub: string,
    storeId: string | null,
    expiresIn: string = '15m',
  ): Promise<string> {
    const payload: JwtPayload = { sub };
    if (storeId) {
      payload.storeId = storeId;
    }
    return this.nestJwtService.signAsync(payload, { expiresIn } as Record<
      string,
      unknown
    >);
  }

  async generateRefreshToken(
    sub: string,
    expiresIn: string = '7d',
  ): Promise<string> {
    return this.nestJwtService.signAsync({ sub }, { expiresIn } as Record<
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
