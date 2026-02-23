/**
 * Standardized error response format for all API errors.
 *
 * This DTO ensures consistent error responses across the application,
 * making it easier for clients to handle errors programmatically.
 */
export interface ErrorResponseDto {
  error: {
    /** Application-specific error code (e.g., 'MERCHANT_NOT_FOUND', 'INVALID_EMAIL') */
    code: string;
    /** Human-readable error message */
    message: string;
    /** HTTP status code */
    statusCode: number;
    /** ISO 8601 timestamp when the error occurred */
    timestamp: string;
    /** Request path that generated the error */
    path: string;
    /** Optional detailed validation errors or additional context */
    details?: ErrorDetail[];
    /** Unique request ID for tracing */
    requestId?: string;
  };
}

/**
 * Individual error detail for validation errors or field-specific issues.
 */
export interface ErrorDetail {
  /** Field name that caused the error */
  field: string;
  /** Specific error message for this field */
  message: string;
  /** Optional rejected value */
  rejectedValue?: unknown;
}
