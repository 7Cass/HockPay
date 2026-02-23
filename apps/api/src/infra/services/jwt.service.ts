import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  IJwtServicePort,
  JwtPayload,
} from '@hockpay/core';

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
    this.nestJwtService = new NestJwtService({
      secret: this.config.get<string>('JWT_SECRET') || 'default-secret',
      signOptions: {
        algorithm: 'HS256',
      },
    });
  }

  async generateAccessToken(
    sub: string,
    expiresIn: string = '15m',
  ): Promise<string> {
    return this.nestJwtService.signAsync(
      { sub },
      { expiresIn } as Record<string, unknown>,
    );
  }

  async generateRefreshToken(
    sub: string,
    expiresIn: string = '7d',
  ): Promise<string> {
    return this.nestJwtService.signAsync(
      { sub },
      { expiresIn } as Record<string, unknown>,
    );
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      return await this.nestJwtService.verifyAsync(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  decodeToken(token: string): JwtPayload | null {
    try {
      return this.nestJwtService.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }
}
