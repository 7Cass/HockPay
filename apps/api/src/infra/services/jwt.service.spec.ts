import { ConfigService } from '@nestjs/config';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { TOKEN_AUDIENCE } from '@hockpay/core';
import { JwtService } from './jwt.service';

const SECRET = 'test-secret';

function makeService(): JwtService {
  const config = {
    get: (key: string) => (key === 'JWT_SECRET' ? SECRET : undefined),
  } as unknown as ConfigService;

  return new JwtService(config);
}

describe('JwtService', () => {
  const service = makeService();

  it('signs the merchant audience into every access token', async () => {
    const token = await service.generateAccessToken('merchant-1', 'store-1');

    expect(service.decodeToken(token)).toMatchObject({
      sub: 'merchant-1',
      storeId: 'store-1',
      aud: TOKEN_AUDIENCE.MERCHANT,
    });
  });

  it('verifies a token it issued', async () => {
    const token = await service.generateAccessToken('merchant-1', null);

    await expect(service.verifyToken(token)).resolves.toMatchObject({
      sub: 'merchant-1',
      aud: TOKEN_AUDIENCE.MERCHANT,
    });
  });

  it('rejects a token signed with the same secret for another audience', async () => {
    const foreign = await new NestJwtService({ secret: SECRET }).signAsync(
      { sub: 'operator-1' },
      { audience: TOKEN_AUDIENCE.OPERATOR },
    );

    await expect(service.verifyToken(foreign)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token issued before the audience existed', async () => {
    const legacy = await new NestJwtService({ secret: SECRET }).signAsync({
      sub: 'merchant-1',
      storeId: 'store-1',
    });

    await expect(service.verifyToken(legacy)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
