import { Merchant } from '../../domain/entities/merchant.entity';
import { InvalidCredentialsError } from '../../domain/errors/invalid-credentials.error';
import { MerchantInactiveError } from '../../domain/errors/merchant-inactive.error';
import { IMerchantRepository } from '../../domain/repositories/merchant.repository.interface';
import { IPasswordHasherPort } from '../ports/password-hasher.port';
import { IJwtServicePort, JwtPayload } from '../ports/jwt-service.port';
import { IRefreshTokenRepositoryPort } from '../ports/refresh-token-repository.port';
import { ITokenGeneratorPort } from '../ports/token-generator.port';
import { RefreshToken } from '../../domain/entities/refresh-token.entity';

/**
 * Input DTO for LoginUseCase.
 */
export interface ILoginInput {
  email: string;
  password: string;
}

/**
 * Output DTO for LoginUseCase.
 */
export interface ILoginOutput {
  accessToken: string;
  refreshToken: string;
  merchant: {
    id: string;
    name: string;
    email: string;
    document: string;
    formattedDocument: string;
    documentType: 'CPF' | 'CNPJ';
  };
  expiresIn: number;
}

/**
 * Use Case: Login
 *
 * This use case handles merchant authentication.
 * It validates credentials, generates access/refresh tokens, and creates a refresh token entity.
 */
export class LoginUseCase {
  constructor(
    private readonly merchantRepository: IMerchantRepository,
    private readonly passwordHasher: IPasswordHasherPort,
    private readonly jwtService: IJwtServicePort,
    private readonly refreshTokenRepository: IRefreshTokenRepositoryPort,
    private readonly tokenGenerator: ITokenGeneratorPort,
  ) {}

  async execute(input: ILoginInput): Promise<ILoginOutput> {
    // 1. Find merchant by email
    const merchant = await this.merchantRepository.findByEmail(input.email);

    if (!merchant) {
      throw new InvalidCredentialsError();
    }

    // 2. Verify password
    const isPasswordValid = await this.passwordHasher.verify(
      input.password,
      merchant.passwordHash,
    );

    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    // 3. Check if merchant is active
    if (!merchant.canLogin()) {
      throw new MerchantInactiveError();
    }

    // 4. Generate access token (15 minutes)
    const accessToken = await this.jwtService.generateAccessToken(
      merchant.id,
      '15m',
    );

    // 5. Generate refresh token string
    const refreshTokenString = this.tokenGenerator.generateBase64(32);

    // 6. Create refresh token entity (7 days expiration - default)
    const refreshToken = RefreshToken.create({
      token: refreshTokenString,
      merchantId: merchant.id,
    });

    // 7. Revoke existing refresh tokens for this merchant
    await this.refreshTokenRepository.revokeAllForMerchant(merchant.id);

    // 8. Save new refresh token
    await this.refreshTokenRepository.create(refreshToken);

    // 9. Return the output
    return {
      accessToken,
      refreshToken: refreshTokenString,
      expiresIn: 900, // 15 minutes in seconds
      merchant: {
        id: merchant.id,
        name: merchant.name,
        email: merchant.email.toString(),
        document: merchant.document.value,
        formattedDocument: merchant.document.formatted,
        documentType: merchant.document.type,
      },
    };
  }
}
