import { Prisma } from '@hockpay/database';
import { mapPrismaError } from './prisma-exception.filter';

describe('mapPrismaError', () => {
  it('maps Payment externalId unique races to EXTERNAL_ID_ALREADY_EXISTS', () => {
    const mapped = mapPrismaError({
      code: 'P2002',
      meta: {
        modelName: 'Payment',
        target: ['storeId', 'environment', 'externalId'],
      },
    } as Prisma.PrismaClientKnownRequestError);

    expect(mapped).toEqual(
      expect.objectContaining({
        code: 'EXTERNAL_ID_ALREADY_EXISTS',
      }),
    );
  });

  it('maps IdempotencyKey unique races to IDEMPOTENCY_KEY_CONFLICT', () => {
    const mapped = mapPrismaError({
      code: 'P2002',
      meta: {
        modelName: 'IdempotencyKey',
        target: ['key', 'storeId', 'environment'],
      },
    } as Prisma.PrismaClientKnownRequestError);

    expect(mapped).toEqual({
      code: 'IDEMPOTENCY_KEY_CONFLICT',
      message: 'Idempotency key was already used with a different request',
    });
  });

  it('does not map unknown unique constraints', () => {
    expect(
      mapPrismaError({
        code: 'P2002',
        meta: { modelName: 'Customer', target: ['storeId', 'document'] },
      } as Prisma.PrismaClientKnownRequestError),
    ).toBeNull();
  });
});
