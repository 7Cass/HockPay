import { UnauthorizedException } from '@nestjs/common';
import {
  InvalidRefreshTokenError,
  LoginUseCase,
  LogoutUseCase,
  RefreshTokenUseCase,
  SwitchStoreUseCase,
} from '@hockpay/core';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const response = () =>
    ({
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    }) as any;

  it('returns 401 instead of 500 when the refresh cookie is missing', async () => {
    const controller = new AuthController(
      {} as LoginUseCase,
      { execute: jest.fn() } as unknown as RefreshTokenUseCase,
      {} as LogoutUseCase,
      {} as SwitchStoreUseCase,
    );

    const res = response();

    await expect(
      controller.refreshToken({ cookies: {} } as any, res),
    ).rejects.toThrow(UnauthorizedException);

    expect(res.clearCookie).toHaveBeenCalledTimes(2);
  });

  it('maps invalid refresh token errors to 401 and clears auth cookies', async () => {
    const controller = new AuthController(
      {} as LoginUseCase,
      {
        execute: jest.fn().mockRejectedValue(new InvalidRefreshTokenError()),
      } as unknown as RefreshTokenUseCase,
      {} as LogoutUseCase,
      {} as SwitchStoreUseCase,
    );

    const res = response();

    await expect(
      controller.refreshToken(
        { cookies: { hockpay_rt: 'bad-token' } } as any,
        res,
      ),
    ).rejects.toThrow(UnauthorizedException);

    expect(res.clearCookie).toHaveBeenCalledTimes(2);
  });
});
