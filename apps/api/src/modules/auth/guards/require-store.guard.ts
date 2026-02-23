import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Require Store Guard
 *
 * This guard ensures that a store is selected before allowing access to a route.
 * Use this guard on routes that require a store context.
 *
 * @example
 * ```typescript
 * @Controller('payments')
 * @UseGuards(JwtAuthGuard, RequireStoreGuard)
 * export class PaymentController {
 *   // All methods require a store to be selected
 * }
 * ```
 */
@Injectable()
export class RequireStoreGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.storeId) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message:
          'No store selected. Please select a store before performing this action.',
        code: 'NO_CURRENT_STORE',
      });
    }

    return true;
  }
}
