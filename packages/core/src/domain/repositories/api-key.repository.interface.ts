import { ApiKey } from '../entities/api-key.entity';

/**
 * Interface for ApiKey Repository.
 *
 * This interface is defined in the domain layer and represents the contract
 * that any infrastructure implementation must follow.
 *
 * The application layer depends on this interface, not on the concrete implementation.
 * This follows the Dependency Inversion Principle from Clean Architecture.
 */
export interface IApiKeyRepository {
  /**
   * Save a new API key to the repository.
   */
  save(apiKey: ApiKey): Promise<void>;

  /**
   * Find an API key by ID.
   * Returns null if not found.
   */
  findById(id: string): Promise<ApiKey | null>;

  /**
   * Find an API key by its hash and environment.
   * Used for authentication via API key.
   * Returns null if not found.
   */
  findByKeyHash(keyHash: string, environment: 'TEST' | 'LIVE'): Promise<ApiKey | null>;

  /**
   * Find all API keys for a store.
   *
   * @param storeId - The store ID
   * @param includeRevoked - Whether to include revoked keys (default: false)
   * @returns Array of API keys
   */
  findByStoreId(storeId: string, includeRevoked?: boolean): Promise<ApiKey[]>;

  /**
   * Update an existing API key.
   */
  update(apiKey: ApiKey): Promise<void>;

  /**
   * Delete an API key by ID (hard delete).
   */
  delete(id: string): Promise<void>;
}
