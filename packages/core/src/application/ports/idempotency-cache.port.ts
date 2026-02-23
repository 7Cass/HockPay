/**
 * Port: Idempotency Cache
 *
 * Interface for caching idempotency responses in Redis.
 * Provides fast lookup for recent requests before hitting PostgreSQL.
 */
export interface IIdempotencyCachePort {
  /**
   * Get a cached response from Redis.
   *
   * @param cacheKey - The cache key (usually SHA256 of key + storeId)
   * @returns The cached response or null if not found
   */
  get(cacheKey: string): Promise<CachedIdempotencyResponse | null>;

  /**
   * Cache a response in Redis.
   *
   * @param cacheKey - The cache key
   * @param response - The response to cache
   * @param ttlSeconds - Time-to-live in seconds (default: 86400 = 24 hours)
   */
  set(
    cacheKey: string,
    response: CachedIdempotencyResponse,
    ttlSeconds?: number,
  ): Promise<void>;

  /**
   * Delete a cached response.
   *
   * @param cacheKey - The cache key to delete
   */
  delete(cacheKey: string): Promise<void>;
}

/**
 * Cached idempotency response structure.
 */
export interface CachedIdempotencyResponse {
  /** SHA256 hash of the original request body */
  requestHash: string;
  /** The response body to return */
  responseBody: Record<string, unknown>;
  /** The HTTP status code to return */
  responseStatus: number;
}
