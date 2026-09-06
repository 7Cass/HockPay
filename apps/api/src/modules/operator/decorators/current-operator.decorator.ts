import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Current operator, as attached by the OperatorAuthGuard.
 */
export interface CurrentOperatorData {
  operatorId: string;
}

export const CurrentOperator = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentOperatorData => {
    const request = ctx.switchToHttp().getRequest();

    return { operatorId: request.operator?.sub };
  },
);
