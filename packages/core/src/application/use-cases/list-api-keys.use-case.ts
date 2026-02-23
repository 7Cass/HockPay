import { IApiKeyRepository } from '../../domain/repositories/api-key.repository.interface';
import { type ApiKeyObject } from '../../domain/entities/api-key.entity';

/**
 * Input DTO for ListApiKeysUseCase.
 */
export interface IListApiKeysInput {
  storeId: string;
  includeRevoked?: boolean;
}

/**
 * Output DTO for ListApiKeysUseCase.
 */
export interface IListApiKeysOutput {
  apiKeys: ApiKeyObject[];
}

/**
 * Use Case: List API Keys
 *
 * This use case retrieves all API keys for a given store.
 *
 * By default, only active (non-revoked) keys are returned.
 * Set includeRevoked to true to include revoked keys.
 *
 * IMPORTANT: The plain API key is NEVER included in the output.
 * Only the prefix (first 8 characters) is shown for identification.
 */
export class ListApiKeysUseCase {
  constructor(private readonly apiKeyRepository: IApiKeyRepository) {}

  async execute(input: IListApiKeysInput): Promise<IListApiKeysOutput> {
    const apiKeys = await this.apiKeyRepository.findByStoreId(
      input.storeId,
      input.includeRevoked ?? false,
    );

    // Convert to plain objects (excludes keyHash)
    return {
      apiKeys: apiKeys.map((key) => key.toObject()),
    };
  }
}
