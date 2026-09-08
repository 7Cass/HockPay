import { IRefreshTokenRepositoryPort } from '../ports/refresh-token-repository.port';

/**
 * Input DTO for LogoutUseCase.
 */
export interface ILogoutInput {
  merchantId: string;
}

/**
 * Use Case: Logout
 *
 * Closes the session of the authenticated merchant by revoking their refresh
 * token.
 *
 * It revokes **by principal, not by the refresh cookie**, for the same reason
 * `OperatorLogoutUseCase` does: `hockpay_rt` is scoped to
 * `/api/v1/auth/refresh` and a browser never sends it to the logout route. A
 * logout that reads that cookie reads `undefined` every time, revokes nothing,
 * and still answers `204` -- the session looks closed and stays open in the
 * database for the seven days the token lives.
 *
 * Logging out with no open session is a no-op, so the route stays idempotent:
 * clicking logout twice is not an error.
 */
export class LogoutUseCase {
  constructor(private readonly refreshTokenRepository: IRefreshTokenRepositoryPort) {}

  async execute(input: ILogoutInput): Promise<void> {
    const token = await this.refreshTokenRepository.findByMerchantId(input.merchantId);

    if (!token || token.isRevoked()) {
      return;
    }

    token.revoke();
    await this.refreshTokenRepository.update(token);
  }
}
