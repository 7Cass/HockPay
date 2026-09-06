import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { OperatorJwtService } from 'src/infra/services/operator-jwt.service';

export const OPERATOR_ACCESS_COOKIE = 'hockpay_op_at';
export const OPERATOR_REFRESH_COOKIE = 'hockpay_op_rt';

const AUTH_REQUIRED_MESSAGE = 'Operator authentication required';

/**
 * Operator Authentication Guard
 *
 * Authenticates the operator principal from its own cookie, verified with its
 * own secret. An API key is never a way in here, and a merchant cookie is not
 * even read: the two principals do not share a door.
 */
@Injectable()
export class OperatorAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly operatorJwtService: OperatorJwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const accessToken = request.cookies?.[OPERATOR_ACCESS_COOKIE];

    if (!accessToken) {
      throw new UnauthorizedException(AUTH_REQUIRED_MESSAGE);
    }

    const payload = await this.operatorJwtService.verifyToken(accessToken);

    if (!payload.sub) {
      throw new UnauthorizedException(AUTH_REQUIRED_MESSAGE);
    }

    request.operator = { sub: payload.sub };

    return true;
  }
}
