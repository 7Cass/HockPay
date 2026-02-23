import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for idempotency configuration.
 */
export const IDEMPOTENCY_KEY = 'idempotency';

/**
 * Options for the @Idempotent() decorator.
 */
export interface IdempotencyOptions {
  /**
   * Time-to-live in seconds for cached responses.
   * Default: 86400 (24 hours)
   */
  ttlSeconds?: number;

  /**
   * If true, the Idempotency-Key header is required.
   * Requests without the header will receive 400 Bad Request.
   * Default: false
   */
  required?: boolean;
}

/**
 * Decorator to mark an endpoint as idempotent.
 *
 * When applied to a POST/PATCH/PUT/DELETE endpoint, the IdempotencyInterceptor
 * will cache responses based on the `Idempotency-Key` header.
 *
 * @example
 * ```typescript
 * // Optional - header may or may not be sent
 * @Post()
 * @Idempotent()
 * async createSomething(@Body() dto: CreateDto) { ... }
 * ```
 *
 * @example
 * ```typescript
 * // Required - must send Idempotency-Key header
 * @Post()
 * @Idempotent({ required: true })
 * async createPayment(@Body() dto: CreatePaymentDto) { ... }
 * ```
 *
 * @example
 * ```typescript
 * // Required with custom TTL
 * @Post()
 * @Idempotent({ required: true, ttlSeconds: 3600 })
 * async createCriticalResource(@Body() dto: CreateDto) { ... }
 * ```
 */
export const Idempotent = (options?: IdempotencyOptions) => {
  return SetMetadata(IDEMPOTENCY_KEY, options ?? {});
};
