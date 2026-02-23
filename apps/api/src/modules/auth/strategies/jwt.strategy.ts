import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtService } from 'src/infra/services/jwt.service';
import type { JwtPayload } from '@hockpay/core';

/**
 * JWT Authentication Strategy
 *
 * This strategy validates JWT tokens from the Authorization header.
 * It extracts the merchant ID (sub) from the token payload.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'default-secret',
      passReqToCallback: true,
    });
  }

  /**
   * Validate the JWT payload.
   * This method is called automatically by Passport after verifying the token.
   */
  async validate(payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Return the payload which will be attached to request.user
    return {
      sub: payload.sub,
      iat: payload.iat,
      exp: payload.exp,
    };
  }
}
