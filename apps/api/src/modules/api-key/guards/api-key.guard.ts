import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ValidateApiKeyUseCase } from '@hockpay/core';

/**
 * Guard that authenticates requests via API Key.
 *
 * This guard validates the Authorization header with format:
 * Authorization: Bearer hk_test_... or Authorization: Bearer hk_live_...
 *
 * On successful validation:
 * - The store is injected into the request for use in controllers
 * - The API key's lastUsedAt timestamp is updated
 *
 * On failure:
 * - Throws UnauthorizedException with appropriate message
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly validateApiKeyUseCase: ValidateApiKeyUseCase) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Extract the Bearer token from the header
    const authorization = request.headers?.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const plainKey = authorization.slice(7); // Remove "Bearer "

    // Validate the API key using the use case
    try {
      const result = await this.validateApiKeyUseCase.execute({ plainKey });

      // Inject the store into the request for use in controllers
      request.store = {
        id: result.storeId,
      };

      this.logger.debug(
        `API Key authenticated: ${result.apiKey.prefix} for store ${result.storeId}`,
      );

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error(
        `Error validating API key: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      throw new UnauthorizedException('Invalid API key');
    }
  }
}

/**
 * Extend the Express Request interface to include the store.
 */
declare global {
  namespace Express {
    interface Request {
      store?: {
        id: string;
      };
    }
  }
}
