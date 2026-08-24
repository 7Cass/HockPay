import { ApiKey } from '../../domain/entities/api-key.entity';
import { IApiKeyRepository } from '../../domain/repositories/api-key.repository.interface';
import { InvalidApiKeyFormatError } from '../../domain/errors/invalid-api-key-format.error';
import { ApiKeyRevokedError } from '../../domain/errors/api-key-revoked.error';
import { ITokenGeneratorPort } from '../ports/token-generator.port';

/**
 * Input DTO for ValidateApiKeyUseCase.
 */
export interface IValidateApiKeyInput {
  plainKey: string;
}

/**
 * Output DTO for ValidateApiKeyUseCase.
 *
 * Contains the validated API key and store information.
 */
export interface IValidateApiKeyOutput {
  apiKey: ApiKey;
  storeId: string;
}

/**
 * Use Case: Validate API Key
 *
 * This use case validates an API key for authentication.
 * It is used by the ApiKeyGuard to protect public API endpoints.
 *
 * Validation steps:
 * 1. Check format: hk_{environment}_{32_chars}
 * 2. Hash the key and look it up in the database
 * 3. Verify the key is not revoked
 * 4. Return the validated key for use in the request context
 */
export class ValidateApiKeyUseCase {
  constructor(
    private readonly apiKeyRepository: IApiKeyRepository,
    private readonly tokenGenerator: ITokenGeneratorPort,
  ) {}

  async execute(input: IValidateApiKeyInput): Promise<IValidateApiKeyOutput> {
    // 1. Validate format
    if (!input.plainKey.startsWith('hk_')) {
      throw new InvalidApiKeyFormatError();
    }

    const parts = input.plainKey.split('_');
    if (parts.length < 3) {
      throw new InvalidApiKeyFormatError();
    }

    const env = parts[1];
    if (env !== 'test' && env !== 'live') {
      throw new InvalidApiKeyFormatError();
    }
    const environment = env === 'test' ? 'TEST' : 'LIVE';

    // 2. Hash the key
    const keyHash = this.tokenGenerator.hash(input.plainKey);

    // 3. Find by hash and environment
    const apiKey = await this.apiKeyRepository.findByKeyHash(keyHash, environment);

    if (!apiKey) {
      throw new InvalidApiKeyFormatError();
    }

    // 4. Check if revoked
    if (!apiKey.isValid()) {
      throw new ApiKeyRevokedError(apiKey.id);
    }

    // 5. Update last used timestamp
    apiKey.updateLastUsed();

    // 6. Persist the update
    await this.apiKeyRepository.update(apiKey);

    // 7. Return the validated key
    return {
      apiKey,
      storeId: apiKey.storeId,
    };
  }
}
