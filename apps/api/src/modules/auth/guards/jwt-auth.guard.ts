import { Injectable, ExecutionContext, SetMetadata } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';

/**
 * JWT Authentication Guard
 *
 * This guard protects routes by requiring a valid JWT token.
 * It can be used with the @UseGuards(JwtAuthGuard) decorator.
 *
 * Optionally, you can make routes public using the @Public() decorator.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Check if the route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}

/**
 * Public Route Decorator
 *
 * Use this decorator to mark routes that should not require authentication.
 * Example: @Public()
 *
 * Usage with controller:
 * @Public()
 * @Post('login')
 * async login() { ... }
 */
export const Public = () => SetMetadata('isPublic', true);
