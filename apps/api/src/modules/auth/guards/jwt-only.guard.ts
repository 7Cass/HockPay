import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class JwtOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.authType === 'api_key') {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'This operation requires dashboard authentication',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }
    return true;
  }
}
