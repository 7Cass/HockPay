import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { OperatorAuthGuard } from '../guards/operator-auth.guard';

export const IS_OPERATOR_ROUTE_KEY = 'isOperatorRoute';

/**
 * Marks a controller as belonging to the operator surface.
 *
 * It does two things at once, and that is the point: it tells the global
 * merchant guard to step aside *and* installs the operator guard. There is no
 * way to declare a route as operator-owned and leave it unguarded, because the
 * two halves are the same decorator.
 */
export const OperatorRoute = () =>
  applyDecorators(
    SetMetadata(IS_OPERATOR_ROUTE_KEY, true),
    UseGuards(OperatorAuthGuard),
  );
