import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Current Store Decorator
 *
 * Injects the current store ID into the controller method.
 * Throws 403 Forbidden if no store is selected.
 *
 * @example
 * ```typescript
 * @Get('api-keys')
 * getApiKeys(@CurrentStore() storeId: string) {
 *   // storeId guaranteed to be a string
 *   // Returns 403 if merchant has no store selected
 * }
 * ```
 */
export const CurrentStore = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();

    // CombinedAuthGuard sets either request.store.id (API Key) or request.user.storeId (JWT)
    const storeId = request.store?.id || request.user?.storeId;

    if (!storeId) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message:
          'No store selected or could not be determined from authentication context.',
        code: 'NO_CURRENT_STORE',
      });
    }

    return storeId;
  },
);
