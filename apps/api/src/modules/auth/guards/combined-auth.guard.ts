import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ValidateApiKeyUseCase, JwtPayload, Environment } from '@hockpay/core';
import { JwtService } from 'src/infra/services/jwt.service';

const AUTH_REQUIRED_MESSAGE =
  'Authentication required. Provide either a valid API key (Authorization: Bearer hk_xxx) or JWT cookie (hockpay_at).';
const INVALID_CREDENTIALS_MESSAGE = 'Invalid credentials';

@Injectable()
export class CombinedAuthGuard implements CanActivate {
  private readonly logger = new Logger(CombinedAuthGuard.name);

  constructor(
    private readonly validateApiKeyUseCase: ValidateApiKeyUseCase,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = extractApiKey(request.headers?.authorization);

    if (apiKey) {
      return this.authenticateApiKey(request, apiKey);
    }

    const accessToken = request.cookies?.hockpay_at;
    if (accessToken) {
      return this.authenticateJwt(request, accessToken);
    }

    throw new UnauthorizedException(AUTH_REQUIRED_MESSAGE);
  }

  private async authenticateApiKey(
    request: AuthenticatedRequest,
    plainKey: string,
  ): Promise<true> {
    try {
      const result = await this.validateApiKeyUseCase.execute({
        plainKey,
      });

      request.store = { id: result.storeId };
      request.environment = result.apiKey.environment;
      request.authType = 'api_key';

      this.logger.debug(`API Key authenticated for store ${result.storeId}`);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.debug(`API Key validation failed: ${errorMsg}`);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }
  }

  private async authenticateJwt(
    request: AuthenticatedRequest,
    accessToken: string,
  ): Promise<true> {
    try {
      const payload: JwtPayload =
        await this.jwtService.verifyToken(accessToken);

      if (!payload.sub) {
        throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
      }

      request.user = {
        sub: payload.sub,
        storeId: payload.storeId ?? null,
        iat: payload.iat,
        exp: payload.exp,
      };
      request.authType = 'jwt';
      request.environment = Environment.TEST;

      if (payload.storeId) {
        request.store = { id: payload.storeId };
      }

      this.logger.debug(
        `JWT authenticated for merchant ${payload.sub}, store ${payload.storeId ?? 'none'}`,
      );
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.debug(`JWT validation failed: ${errorMsg}`);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }
  }
}

export function extractApiKey(authorization?: string): string | null {
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  const token = authorization.slice(7);
  return token.startsWith('hk_') ? token : null;
}

type AuthenticatedRequest = {
  store?: { id: string };
  environment?: Environment;
  authType?: 'api_key' | 'jwt';
  user?: {
    sub: string;
    storeId: string | null;
    iat?: number;
    exp?: number;
  };
  cookies?: { hockpay_at?: string };
  headers?: { authorization?: string };
};

declare global {
  namespace Express {
    interface Request {
      authType?: 'api_key' | 'jwt';
      environment?: Environment;
      store?: { id: string };
    }
  }
}
