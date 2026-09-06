import 'reflect-metadata';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { OperatorModule } from './operator.module';
import { OperatorAuthGuard } from './guards/operator-auth.guard';
import { IS_OPERATOR_ROUTE_KEY } from './decorators/operator-route.decorator';

type ControllerClass = new (...args: never[]) => unknown;

function operatorControllers(): ControllerClass[] {
  return (Reflect.getMetadata('controllers', OperatorModule) ??
    []) as ControllerClass[];
}

/**
 * The failure mode this guards against is a future controller added to the
 * operator surface without its guard: an open endpoint that no test would
 * otherwise notice. It is checked here instead of in review.
 */
describe('operator surface routes', () => {
  it('registers at least one controller', () => {
    expect(operatorControllers().length).toBeGreaterThan(0);
  });

  it.each(
    operatorControllers().map((controller) => [controller.name, controller]),
  )(
    '%s is marked as an operator route and guarded by OperatorAuthGuard',
    (_name, controller) => {
      expect(Reflect.getMetadata(IS_OPERATOR_ROUTE_KEY, controller)).toBe(true);
      expect(Reflect.getMetadata(GUARDS_METADATA, controller)).toContain(
        OperatorAuthGuard,
      );
    },
  );

  it.each(
    operatorControllers().map((controller) => [controller.name, controller]),
  )('%s lives under the operator path prefix', (_name, controller) => {
    const path = Reflect.getMetadata(PATH_METADATA, controller) as string;
    expect(path === 'operator' || path.startsWith('operator/')).toBe(true);
  });
});
