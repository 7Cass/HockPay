import { DomainError } from './domain-error';

export class ProductNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Product not found: ${id}`, 'PRODUCT_NOT_FOUND');
  }
}
