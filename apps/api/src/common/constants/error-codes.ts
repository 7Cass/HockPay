/**
 * Centralized mapping of domain error codes to HTTP status codes.
 *
 * This mapping ensures that domain errors are translated to appropriate
 * HTTP status codes, providing semantic responses to API clients.
 */
export const ERROR_CODE_MAP: Record<string, number> = {
  // Validation Errors (400 Bad Request)
  INVALID_EMAIL: 400,
  INVALID_DOCUMENT: 400,
  INVALID_NAME: 400,
  INVALID_PASSWORD: 400,
  INVALID_AMOUNT: 400,
  INVALID_CURRENCY: 400,
  INVALID_WEBHOOK_URL: 400,
  INVALID_ALERT_CHANNEL: 400,
  INVALID_ALERT_EVENTS: 400,
  INVALID_ALERT_CONFIG: 400,
  INVALID_WITHDRAWAL_AMOUNT: 400,
  INVALID_PRODUCT: 400,
  INVALID_LINE_ITEMS: 400,

  // Conflict Errors (409 Conflict)
  MERCHANT_ALREADY_EXISTS: 409,
  API_KEY_ALREADY_EXISTS: 409,
  PAYMENT_ALREADY_CONFIRMED: 409,
  PAYMENT_ALREADY_REFUNDED: 409,
  INVALID_WITHDRAWAL_STATUS: 409,
  BANK_ACCOUNT_IN_USE: 409,
  PRODUCT_EXTERNAL_ID_ALREADY_EXISTS: 409,

  // Not Found Errors (404 Not Found)
  MERCHANT_NOT_FOUND: 404,
  PAYMENT_NOT_FOUND: 404,
  API_KEY_NOT_FOUND: 404,
  WEBHOOK_CONFIG_NOT_FOUND: 404,
  ALERT_CONFIG_NOT_FOUND: 404,
  ALERT_DELIVERY_LOG_NOT_FOUND: 404,
  ACCOUNT_NOT_FOUND: 404,
  BANK_ACCOUNT_NOT_FOUND: 404,
  WITHDRAWAL_NOT_FOUND: 404,
  PRODUCT_NOT_FOUND: 404,

  // Business rule errors (422 Unprocessable Entity)
  BANK_ACCOUNT_NOT_VERIFIED: 422,
  INSUFFICIENT_WITHDRAWAL_BALANCE: 422,
  STORE_INACTIVE: 422,
  STORE_NOT_APPROVED: 422,
  WITHDRAWAL_LIMIT_EXCEEDED: 422,
  PRODUCT_UNAVAILABLE: 422,

  // Authentication Errors (401 Unauthorized)
  API_KEY_INVALID: 401,
  API_KEY_EXPIRED: 401,
  API_KEY_MISSING: 401,
  INVALID_CREDENTIALS: 401,

  // Authorization Errors (403 Forbidden)
  INSUFFICIENT_PERMISSIONS: 403,
  MERCHANT_MISMATCH: 403,

  // Rate Limiting (429 Too Many Requests)
  RATE_LIMIT_EXCEEDED: 429,

  // Server Errors (500 Internal Server Error)
  INTERNAL_ERROR: 500,
  DATABASE_ERROR: 500,
  QUEUE_ERROR: 500,
} as const;

/**
 * Error categories for grouping related error codes.
 * Useful for logging, monitoring, and applying category-specific handling.
 */
export const ERROR_CATEGORIES = {
  /** Input validation and data format errors */
  VALIDATION: [
    'INVALID_EMAIL',
    'INVALID_DOCUMENT',
    'INVALID_NAME',
    'INVALID_PASSWORD',
    'INVALID_AMOUNT',
    'INVALID_CURRENCY',
    'INVALID_WEBHOOK_URL',
    'INVALID_ALERT_CHANNEL',
    'INVALID_ALERT_EVENTS',
    'INVALID_ALERT_CONFIG',
    'INVALID_WITHDRAWAL_AMOUNT',
    'INVALID_PRODUCT',
    'INVALID_LINE_ITEMS',
  ],

  /** Resource already exists or state conflicts */
  CONFLICT: [
    'MERCHANT_ALREADY_EXISTS',
    'API_KEY_ALREADY_EXISTS',
    'PAYMENT_ALREADY_CONFIRMED',
    'PAYMENT_ALREADY_REFUNDED',
    'INVALID_WITHDRAWAL_STATUS',
    'BANK_ACCOUNT_IN_USE',
    'PRODUCT_EXTERNAL_ID_ALREADY_EXISTS',
  ],

  /** Requested resource does not exist */
  NOT_FOUND: [
    'MERCHANT_NOT_FOUND',
    'PAYMENT_NOT_FOUND',
    'API_KEY_NOT_FOUND',
    'WEBHOOK_CONFIG_NOT_FOUND',
    'ALERT_CONFIG_NOT_FOUND',
    'ALERT_DELIVERY_LOG_NOT_FOUND',
    'ACCOUNT_NOT_FOUND',
    'BANK_ACCOUNT_NOT_FOUND',
    'WITHDRAWAL_NOT_FOUND',
    'PRODUCT_NOT_FOUND',
  ],

  /** Authentication and identity verification failures */
  AUTHENTICATION: [
    'API_KEY_INVALID',
    'API_KEY_EXPIRED',
    'API_KEY_MISSING',
    'INVALID_CREDENTIALS',
  ],

  /** Permission and access control failures */
  AUTHORIZATION: ['INSUFFICIENT_PERMISSIONS', 'MERCHANT_MISMATCH'],

  BUSINESS: ['PRODUCT_UNAVAILABLE'],

  /** Rate limiting and throttling */
  RATE_LIMIT: ['RATE_LIMIT_EXCEEDED'],

  /** Unexpected server-side errors */
  SERVER: ['INTERNAL_ERROR', 'DATABASE_ERROR', 'QUEUE_ERROR'],
} as const;

/**
 * Get the HTTP status code for a given error code.
 * Returns 500 for unknown error codes (fail-safe default).
 */
export function getStatusCodeForError(code: string): number {
  return ERROR_CODE_MAP[code] ?? 500;
}

/**
 * Get the category for a given error code.
 * Returns 'SERVER' for unknown error codes.
 */
export function getErrorCategory(code: string): string | undefined {
  for (const [category, codes] of Object.entries(ERROR_CATEGORIES)) {
    if (codes.includes(code as never)) {
      return category.toLowerCase();
    }
  }
  return 'server';
}
