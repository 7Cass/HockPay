import { ForbiddenException } from '@nestjs/common';
import { JwtOnlyGuard } from './jwt-only.guard';

describe('JwtOnlyGuard', () => {
  const guard = new JwtOnlyGuard();

  it('rejects API key callers', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ authType: 'api_key' }),
      }),
    };

    expect(() => guard.canActivate(context as never)).toThrow(
      ForbiddenException,
    );
  });

  it('allows dashboard JWT callers', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ authType: 'jwt', user: { storeId: 'store-1' } }),
      }),
    };

    expect(guard.canActivate(context as never)).toBe(true);
  });
});
