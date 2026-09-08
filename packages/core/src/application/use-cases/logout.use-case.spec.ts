import { describe, expect, it, vi } from 'vitest';
import { RefreshToken } from '../../domain/entities/refresh-token.entity';
import { IRefreshTokenRepositoryPort } from '../ports/refresh-token-repository.port';
import { LogoutUseCase } from './logout.use-case';

/**
 * In-memory stand-in, keyed by merchant the way the table is: `merchantId` is
 * unique, so a merchant has at most one refresh token.
 */
function makeRepository(seed?: RefreshToken) {
  const tokens = new Map<string, RefreshToken>();

  if (seed) {
    tokens.set(seed.merchantId, seed);
  }

  const repository: IRefreshTokenRepositoryPort = {
    create: vi.fn(async (token: RefreshToken) => {
      tokens.set(token.merchantId, token);
    }),
    findByToken: vi.fn(async (value: string) => {
      return [...tokens.values()].find((token) => token.token === value) ?? null;
    }),
    findByTokenForUpdate: vi.fn(async () => null),
    findByMerchantId: vi.fn(async (merchantId: string) => tokens.get(merchantId) ?? null),
    update: vi.fn(async (token: RefreshToken) => {
      tokens.set(token.merchantId, token);
    }),
    revokeAllForMerchant: vi.fn(async (merchantId: string) => {
      tokens.delete(merchantId);
    }),
    deleteExpired: vi.fn(async () => undefined),
  };

  return { repository, tokens };
}

describe('merchant logout', () => {
  it('revokes the session of the authenticated merchant', async () => {
    const token = RefreshToken.create({ token: 'refresh-1', merchantId: 'merchant-1' });
    const { repository, tokens } = makeRepository(token);

    await new LogoutUseCase(repository).execute({ merchantId: 'merchant-1' });

    expect(tokens.get('merchant-1')?.isRevoked()).toBe(true);
    expect(repository.update).toHaveBeenCalledTimes(1);
  });

  it('finds the session by merchant, never by the refresh cookie', async () => {
    // The regression this file exists for. `hockpay_rt` is scoped to
    // `/api/v1/auth/refresh`, so it never reaches the logout route: a logout
    // that looked the token up by its string revoked nothing and still
    // answered 204, leaving the session alive in the database for seven days.
    const token = RefreshToken.create({ token: 'refresh-1', merchantId: 'merchant-1' });
    const { repository } = makeRepository(token);

    await new LogoutUseCase(repository).execute({ merchantId: 'merchant-1' });

    expect(repository.findByMerchantId).toHaveBeenCalledWith('merchant-1');
    expect(repository.findByToken).not.toHaveBeenCalled();
  });

  it('is a no-op when there is no open session', async () => {
    const { repository } = makeRepository();

    await expect(
      new LogoutUseCase(repository).execute({ merchantId: 'merchant-1' }),
    ).resolves.toBeUndefined();

    expect(repository.update).not.toHaveBeenCalled();
  });

  it('does not revoke an already revoked session twice', async () => {
    const token = RefreshToken.create({ token: 'refresh-1', merchantId: 'merchant-1' });
    token.revoke();
    const { repository } = makeRepository(token);

    await new LogoutUseCase(repository).execute({ merchantId: 'merchant-1' });

    expect(repository.update).not.toHaveBeenCalled();
  });

  it('leaves another merchant session untouched', async () => {
    const mine = RefreshToken.create({ token: 'refresh-1', merchantId: 'merchant-1' });
    const { repository, tokens } = makeRepository(mine);
    const theirs = RefreshToken.create({ token: 'refresh-2', merchantId: 'merchant-2' });
    tokens.set(theirs.merchantId, theirs);

    await new LogoutUseCase(repository).execute({ merchantId: 'merchant-1' });

    expect(tokens.get('merchant-1')?.isRevoked()).toBe(true);
    expect(tokens.get('merchant-2')?.isRevoked()).toBe(false);
  });
});
