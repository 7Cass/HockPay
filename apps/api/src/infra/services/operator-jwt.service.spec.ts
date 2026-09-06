import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { TOKEN_AUDIENCE } from '@hockpay/core';
import { OperatorJwtService } from './operator-jwt.service';
import { JwtService } from './jwt.service';

const MERCHANT_SECRET = 'merchant-secret';
const OPERATOR_SECRET = 'operator-secret';

function makeConfig(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('OperatorJwtService', () => {
  const operatorJwt = new OperatorJwtService(
    makeConfig({ OPERATOR_JWT_SECRET: OPERATOR_SECRET }),
  );
  const merchantJwt = new JwtService(
    makeConfig({ JWT_SECRET: MERCHANT_SECRET }),
  );

  it('fails at boot without its own secret', () => {
    expect(() => new OperatorJwtService(makeConfig({}))).toThrow(
      'OPERATOR_JWT_SECRET environment variable is required',
    );
  });

  it('does not fall back to the merchant secret', () => {
    expect(
      () => new OperatorJwtService(makeConfig({ JWT_SECRET: MERCHANT_SECRET })),
    ).toThrow('OPERATOR_JWT_SECRET environment variable is required');
  });

  it('signs and verifies its own token', async () => {
    const token = await operatorJwt.generateAccessToken('operator-1');

    await expect(operatorJwt.verifyToken(token)).resolves.toMatchObject({
      sub: 'operator-1',
      aud: TOKEN_AUDIENCE.OPERATOR,
    });
  });

  it('rejects a merchant token', async () => {
    const merchantToken = await merchantJwt.generateAccessToken(
      'merchant-1',
      'store-1',
    );

    await expect(operatorJwt.verifyToken(merchantToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('mints a token the merchant verifier refuses', async () => {
    const operatorToken = await operatorJwt.generateAccessToken('operator-1');

    await expect(merchantJwt.verifyToken(operatorToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
