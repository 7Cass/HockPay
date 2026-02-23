import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Current User Data returned by the CurrentUser decorator.
 */
export interface CurrentUserData {
  merchantId: string;
  storeId: string | null;
}

/**
 * Current User Decorator
 *
 * Injects the current user data into the controller method.
 * Returns both merchantId and storeId (which may be null if no store is selected).
 *
 * @example
 * ```typescript
 * @Get('profile')
 * getProfile(@CurrentUser() user: CurrentUserData) {
 *   // user.merchantId always available
 *   // user.storeId may be null
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserData => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return {
      merchantId: user?.sub,
      storeId: user?.storeId ?? null,
    };
  },
);
