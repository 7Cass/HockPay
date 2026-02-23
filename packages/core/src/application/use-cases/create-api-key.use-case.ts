import { ApiKey, type ApiKeyObject } from '../../domain/entities/api-key.entity';
import { Environment } from '../../domain/value-objects/environment.vo';
import { IApiKeyRepository } from '../../domain/repositories/api-key.repository.interface';
import { ITokenGeneratorPort } from '../ports/token-generator.port';

/**
 * Input DTO for CreateApiKeyUseCase.
 */
export interface ICreateApiKeyInput {
  storeId: string;
  name: string;
  environment: Environment;
}

/**
 * Output DTO for CreateApiKeyUseCase.
 *
 * Note: The plain API key is only returned once during creation.
 * This is the only time the merchant will see the full key value.
 */
export interface ICreateApiKeyOutput {
  apiKey: ApiKeyObject;
  plainKey: string;
}

/**
 * Use Case: Create API Key
 *
 * This use case handles the creation of a new API key for a store.
 *
 * The API key format is: hk_{environment}_{32_random_hex_chars}
 * Example: hk_test_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
 *
 * The key is stored as a SHA-256 hash in the database.
 * The plain key is only returned once, during creation.
 */
export class CreateApiKeyUseCase {
  constructor(
    private readonly apiKeyRepository: IApiKeyRepository,
    private readonly tokenGenerator: ITokenGeneratorPort,
  ) {}

  async execute(input: ICreateApiKeyInput): Promise<ICreateApiKeyOutput> {
    // 1. Determine the environment enum value
    const environment = input.environment;

    // 2. Generate the plain API key (use lowercase for the key format)
    const envString = input.environment === Environment.TEST ? 'test' : 'live';
    const randomPart = this.tokenGenerator.generate(16); // 32 hex chars
    const plainKey = `hk_${envString}_${randomPart}`;

    // 3. Generate the prefix (first 8 chars for display)
    const prefix = plainKey.substring(0, 8);

    // 4. Generate the SHA-256 hash of the key
    const keyHash = this.tokenGenerator.hash(plainKey);

    // 5. Create the ApiKey entity
    const apiKey = ApiKey.create({
      storeId: input.storeId,
      name: input.name,
      environment,
      keyHash,
      prefix,
    });

    // 6. Persist the API key
    await this.apiKeyRepository.save(apiKey);

    // 7. Return the output (including the plain key, shown only once)
    return {
      apiKey: apiKey.toObject(),
      plainKey,
    };
  }
}
