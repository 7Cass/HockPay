import { ApiKey, type ApiKeyObject } from '../../domain/entities/api-key.entity';
import { IApiKeyRepository } from '../../domain/repositories/api-key.repository.interface';
import { ApiKeyNotFoundError } from '../../domain/errors/api-key-not-found.error';

/**
 * Input DTO for RevokeApiKeyUseCase.
 */
export interface IRevokeApiKeyInput {
  storeId: string;
  apiKeyId: string;
}

/**
 * Output DTO for RevokeApiKeyUseCase.
 */
export interface IRevokeApiKeyOutput {
  apiKey: ApiKeyObject;
}

/**
 * Use Case: Revoke API Key
 *
 * This use case revokes an API key, making it unusable for authentication.
 *
 * Security considerations:
 * - The API key must belong to the specified store
 * - A revoked key cannot be used for authentication
 * - The revocation is timestamped for audit purposes
 */
export class RevokeApiKeyUseCase {
  constructor(private readonly apiKeyRepository: IApiKeyRepository) {}

  async execute(input: IRevokeApiKeyInput): Promise<IRevokeApiKeyOutput> {
    // 1. Find the API key
    const apiKey = await this.apiKeyRepository.findById(input.apiKeyId);

    if (!apiKey) {
      throw new ApiKeyNotFoundError(input.apiKeyId);
    }

    // 2. Verify the key belongs to the specified store
    if (apiKey.storeId !== input.storeId) {
      throw new ApiKeyNotFoundError(input.apiKeyId);
    }

    // 3. Revoke the key (idempotent - safe to call multiple times)
    if (apiKey.isRevoked()) {
      // Already revoked, just return it
      return { apiKey: apiKey.toObject() };
    }

    // 4. Revoke the key
    apiKey.revoke();

    // 5. Persist the changes
    await this.apiKeyRepository.update(apiKey);

    // 6. Return the revoked key
    return { apiKey: apiKey.toObject() };
  }
}
