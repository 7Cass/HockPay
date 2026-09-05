import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { TOKEN_AUDIENCE, type JwtPayload } from '@hockpay/core';
import { JwtStrategy } from './jwt.strategy';
import { JwtService } from 'src/infra/services/jwt.service';

function makeStrategy(): JwtStrategy {
  const config = {
    get: (key: string) => (key === 'JWT_SECRET' ? 'test-secret' : undefined),
  } as unknown as ConfigService;

  return new JwtStrategy(config, {} as JwtService);
}

describe('JwtStrategy', () => {
  const strategy = makeStrategy();
  const request = {} as never;

  it('accepts a merchant token', async () => {
    const payload: JwtPayload = {
      sub: 'merchant-1',
      aud: TOKEN_AUDIENCE.MERCHANT,
      storeId: 'store-1',
    };

    await expect(strategy.validate(request, payload)).resolves.toMatchObject({
      sub: 'merchant-1',
      storeId: 'store-1',
    });
  });

  it('rejects a token minted for another audience', async () => {
    const payload = {
      sub: 'operator-1',
      aud: TOKEN_AUDIENCE.OPERATOR,
    } as JwtPayload;

    await expect(strategy.validate(request, payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a payload with no audience at all', async () => {
    const payload = { sub: 'merchant-1' } as unknown as JwtPayload;

    await expect(strategy.validate(request, payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
