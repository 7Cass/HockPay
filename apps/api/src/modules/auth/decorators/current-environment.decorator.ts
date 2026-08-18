import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Environment } from '@hockpay/core';

export function resolveCurrentEnvironment(ctx: ExecutionContext): Environment {
  const request = ctx.switchToHttp().getRequest();
  return request.environment ?? Environment.TEST;
}

export const CurrentEnvironment = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Environment =>
    resolveCurrentEnvironment(ctx),
);
