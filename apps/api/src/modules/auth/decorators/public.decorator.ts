import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for marking routes as public.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Public Route Decorator
 *
 * Use this decorator to mark routes that should NOT require authentication.
 * By default, ALL routes require JWT authentication (global guard).
 *
 * Usage on method:
 * ```typescript
 * @Controller('auth')
 * export class AuthController {
 *   @Post('login')
 *   @Public()
 *   async login() { ... }
 * }
 * ```
 *
 * Usage on entire controller:
 * ```typescript
 * @Controller('webhooks')
 * @Public()
 * export class WebhookController { ... }
 * ```
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
