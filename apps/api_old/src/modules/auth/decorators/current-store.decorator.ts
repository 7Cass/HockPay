import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator que extrai a store do request
 *
 * Uso:
 * ```ts
 * @Post()
 * createPayment(@CurrentStore() store: Store) {
 *   // store.id, store.name, etc.
 * }
 * ```
 */
export const CurrentStore = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.store;
  },
);
