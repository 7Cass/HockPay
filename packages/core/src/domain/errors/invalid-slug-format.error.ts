import { DomainError } from './domain-error';

/**
 * Error thrown when a slug format is invalid.
 */
export class InvalidSlugFormatError extends DomainError {
  constructor(slug: string) {
    super(
      `Invalid slug format: ${slug}. Slug must contain only lowercase letters, numbers, and hyphens. It must start and end with alphanumeric characters and be between 3-50 characters.`,
      'INVALID_SLUG_FORMAT',
    );
  }
}
