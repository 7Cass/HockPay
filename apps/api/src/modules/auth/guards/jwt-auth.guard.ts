import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_OPERATOR_ROUTE_KEY } from '../../operator/decorators/operator-route.decorator';

/**
 * JWT Authentication Guard
 *
 * This guard protects routes by requiring a valid JWT token.
 * When registered as a global guard (APP_GUARD), all routes are protected by default.
 *
 * Use the @Public() decorator to mark routes that should not require authentication.
 * Routes of the operator surface are marked with @OperatorRoute(), which both
 * takes them out of this guard and installs the operator guard in its place --
 * marking them @Public() would be a lie, since they do require a principal.
 *
 * Usage:
 * - Global protection: registered as APP_GUARD in AppModule
 * - Public routes: add @Public() decorator to controller method or class
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
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Operator routes authenticate a different principal, with its own guard.
    const isOperatorRoute = this.reflector.getAllAndOverride<boolean>(
      IS_OPERATOR_ROUTE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isOperatorRoute) {
      return true;
    }

    return super.canActivate(context);
  }
}
