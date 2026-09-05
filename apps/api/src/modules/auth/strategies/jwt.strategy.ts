import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtService } from 'src/infra/services/jwt.service';
import { TOKEN_AUDIENCE, type JwtPayload } from '@hockpay/core';
import type { Request } from 'express';

/**
 * Extract JWT token from the hockpay_at cookie.
 * This is used for dashboard authentication.
 */
function extractTokenFromCookie(req: Request): string | null {
  return req.cookies?.hockpay_at || null;
}

/**
 * JWT Authentication Strategy
 *
 * This strategy validates JWT tokens from the hockpay_at cookie.
 * It extracts the merchant ID (sub) from the token payload.
 *
 * It only accepts tokens issued for the merchant audience: a token minted for
 * another principal is rejected here, not filtered downstream.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    super({
      jwtFromRequest: extractTokenFromCookie,
      ignoreExpiration: false,
      secretOrKey: secret,
      audience: TOKEN_AUDIENCE.MERCHANT,
      passReqToCallback: true,
    });
  }

  /**
   * Validate the JWT payload.
   * This method is called automatically by Passport after verifying the token.
   * Note: With passReqToCallback: true, the first argument is the request.
   */
  async validate(_request: Request, payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Belt and braces: the audience option above already rejects a foreign
    // token, but the check does not depend on that option staying in place.
    if (payload.aud !== TOKEN_AUDIENCE.MERCHANT) {
      throw new UnauthorizedException('Invalid token audience');
    }

    // Return the payload which will be attached to request.user
    return {
      sub: payload.sub,
      storeId: payload.storeId ?? null,
      iat: payload.iat,
      exp: payload.exp,
    };
  }
}
