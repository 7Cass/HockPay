import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  OperatorAuthGuard,
  OPERATOR_ACCESS_COOKIE,
} from './operator-auth.guard';
import { OperatorJwtService } from 'src/infra/services/operator-jwt.service';

class TestOperatorController {}
function testHandler() {}

function makeContext(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => testHandler,
    getClass: () => TestOperatorController,
  } as never;
}

describe('OperatorAuthGuard', () => {
  const verifyToken = jest.fn();
  const reflector = new Reflector();
  const guard = new OperatorAuthGuard(reflector, {
    verifyToken,
  } as unknown as OperatorJwtService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('authenticates an operator token from its own cookie', async () => {
    verifyToken.mockResolvedValue({ sub: 'operator-1', aud: 'operator' });

    const request: Record<string, unknown> = {
      cookies: { [OPERATOR_ACCESS_COOKIE]: 'operator-token' },
      headers: {},
    };

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(request.operator).toEqual({ sub: 'operator-1' });
  });

  it('ignores the merchant cookie entirely', async () => {
    const request: Record<string, unknown> = {
      cookies: { hockpay_at: 'merchant-token' },
      headers: {},
    };

    await expect(
      guard.canActivate(makeContext(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('does not accept an API key', async () => {
    const request: Record<string, unknown> = {
      cookies: {},
      headers: { authorization: 'Bearer hk_live_secret' },
    };

    await expect(
      guard.canActivate(makeContext(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('rejects a token the operator verifier refuses', async () => {
    verifyToken.mockRejectedValue(new UnauthorizedException('Invalid token'));

    const request: Record<string, unknown> = {
      cookies: {
        [OPERATOR_ACCESS_COOKIE]: 'merchant-token-in-operator-cookie',
      },
      headers: {},
    };

    await expect(
      guard.canActivate(makeContext(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(request.operator).toBeUndefined();
  });
});
