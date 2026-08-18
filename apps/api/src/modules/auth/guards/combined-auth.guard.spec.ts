import { UnauthorizedException } from '@nestjs/common';
import { Environment } from '@hockpay/core';
import { CombinedAuthGuard } from './combined-auth.guard';

function makeContext(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never;
}

describe('CombinedAuthGuard', () => {
  const validateApiKeyUseCase = {
    execute: jest.fn(),
  };
  const jwtService = {
    verifyToken: jest.fn(),
  };
  const guard = new CombinedAuthGuard(
    validateApiKeyUseCase as never,
    jwtService as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('lets a present API key win over a JWT cookie', async () => {
    validateApiKeyUseCase.execute.mockResolvedValue({
      storeId: 'store-live',
      apiKey: { environment: Environment.LIVE },
    });
    jwtService.verifyToken.mockResolvedValue({
      sub: 'merchant-1',
      storeId: 'store-test',
    });

    const request: Record<string, unknown> = {
      cookies: { hockpay_at: 'jwt-token' },
      headers: { authorization: 'Bearer hk_live_secret' },
    };

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);

    expect(validateApiKeyUseCase.execute).toHaveBeenCalledWith({
      plainKey: 'hk_live_secret',
    });
    expect(jwtService.verifyToken).not.toHaveBeenCalled();
    expect(request.authType).toBe('api_key');
    expect(request.environment).toBe(Environment.LIVE);
    expect(request.store).toEqual({ id: 'store-live' });
  });

  it('authenticates JWT without storeId but does not attach a store', async () => {
    jwtService.verifyToken.mockResolvedValue({
      sub: 'merchant-1',
    });

    const request: Record<string, unknown> = {
      cookies: { hockpay_at: 'jwt-token' },
      headers: {},
    };

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(request.authType).toBe('jwt');
    expect(request.store).toBeUndefined();
    expect(request.user).toMatchObject({
      sub: 'merchant-1',
      storeId: null,
    });
  });

  it('does not leak JWT verifier text in the 401 body', async () => {
    jwtService.verifyToken.mockRejectedValue(new Error('jwt malformed xyz'));

    const request = {
      cookies: { hockpay_at: 'bad-token' },
      headers: {},
    };

    await expect(
      guard.canActivate(makeContext(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    try {
      await guard.canActivate(makeContext(request));
    } catch (error) {
      const response = (error as UnauthorizedException).getResponse();
      const body =
        typeof response === 'string' ? response : JSON.stringify(response);
      expect(body).toContain('Invalid credentials');
      expect(body).not.toContain('jwt malformed');
      expect(body).not.toContain('xyz');
    }
  });

  it('returns a stable message when no credentials are present', async () => {
    await expect(
      guard.canActivate(makeContext({ cookies: {}, headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
