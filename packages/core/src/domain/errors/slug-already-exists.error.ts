import { DomainError } from './domain-error';

/**
 * Error thrown when a store slug already exists.
 */
export class SlugAlreadyExistsError extends DomainError {
  constructor(slug: string) {
    super(`Slug already exists: ${slug}`, 'SLUG_ALREADY_EXISTS');
  }
}
