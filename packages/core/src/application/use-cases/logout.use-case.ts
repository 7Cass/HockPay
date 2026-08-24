import { IRefreshTokenRepositoryPort } from '../ports/refresh-token-repository.port';

/**
 * Input DTO for LogoutUseCase.
 */
export interface ILogoutInput {
  refreshToken: string;
}

/**
 * Use Case: Logout
 *
 * This use case handles merchant logout by revoking their refresh token.
 * This invalidates the token, preventing further refresh operations.
 */
export class LogoutUseCase {
  constructor(private readonly refreshTokenRepository: IRefreshTokenRepositoryPort) {}

  async execute(input: ILogoutInput): Promise<void> {
    // 1. Find the refresh token
    const token = await this.refreshTokenRepository.findByToken(input.refreshToken);

    // 2. If token doesn't exist, that's okay - it might have already been revoked
    // We don't throw an error to allow logout to be idempotent
    if (!token) {
      return;
    }

    // 3. Revoke the token if it's not already revoked
    if (!token.isRevoked()) {
      token.revoke();
      await this.refreshTokenRepository.update(token);
    }
  }
}
