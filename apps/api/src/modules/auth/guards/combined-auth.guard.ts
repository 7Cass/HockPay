import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ValidateApiKeyUseCase, JwtPayload, Environment } from '@hockpay/core';
import { JwtService } from 'src/infra/services/jwt.service';

/**
 * Combined Auth Guard
 *
 * This guard allows authentication via either API Key or JWT Cookie.
 * It tries JWT authentication first (via cookie), then falls back to API Key.
 * Only fails if BOTH authentication methods fail.
 *
 * Use cases:
 * - Public API endpoints that need to work with both M2M (API Key) and Dashboard (JWT) auth
 *
 * Usage:
 * ```typescript
 * @Public()
 * @UseGuards(CombinedAuthGuard)
 * @Controller('customers')
 * export class CustomerController { ... }
 * ```
 */
@Injectable()
export class CombinedAuthGuard implements CanActivate {
  private readonly logger = new Logger(CombinedAuthGuard.name);

  constructor(
    private readonly validateApiKeyUseCase: ValidateApiKeyUseCase,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const errors: string[] = [];

    // 1. Try JWT authentication via cookie first
    const accessToken = request.cookies?.hockpay_at;
    if (accessToken) {
      try {
        const payload: JwtPayload =
          await this.jwtService.verifyToken(accessToken);

        if (!payload.sub) {
          errors.push('Invalid JWT payload');
        } else {
          // Attach user info to request
          request.user = {
            sub: payload.sub,
            storeId: payload.storeId ?? null,
            iat: payload.iat,
            exp: payload.exp,
          };

          // Mark as JWT auth for later use
          request.authType = 'jwt';

          // JWT auth defaults to TEST environment (dashboard)
          request.environment = Environment.TEST;

          // Also set store if available
          if (payload.storeId) {
            request.store = {
              id: payload.storeId,
            };
          }

          this.logger.debug(
            `JWT authenticated for merchant ${payload.sub}, store ${payload.storeId ?? 'none'}`,
          );

          return true;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`JWT: ${errorMsg}`);
        this.logger.debug(`JWT validation failed: ${errorMsg}`);
        // Continue to try API Key authentication
      }
    }

    // 2. Try API Key authentication
    const authorization = request.headers?.authorization;
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.slice(7); // Remove "Bearer "

      // Check if it looks like an API Key (starts with hk_)
      if (token.startsWith('hk_')) {
        try {
          const result = await this.validateApiKeyUseCase.execute({
            plainKey: token,
          });

          // Inject the store into the request
          request.store = {
            id: result.storeId,
          };

          // Inject the environment from the API key
          request.environment = result.apiKey.environment;

          // Mark as API Key auth for later use
          request.authType = 'api_key';

          this.logger.debug(
            `API Key authenticated for store ${result.storeId}`,
          );

          return true;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`API Key: ${errorMsg}`);
          this.logger.debug(`API Key validation failed: ${errorMsg}`);
        }
      }
    }

    // 3. No valid authentication found - include all errors for debugging
    const errorMessage = errors.length > 0
      ? `Authentication failed: ${errors.join('; ')}`
      : 'Authentication required. Provide either a valid API key (Authorization: Bearer hk_xxx) or JWT cookie (hockpay_at).';

    throw new UnauthorizedException(errorMessage);
  }
}

/**
 * Extend the Express Request interface to include auth type.
 */
declare global {
  namespace Express {
    interface Request {
      authType?: 'api_key' | 'jwt';
    }
  }
}
