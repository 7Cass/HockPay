import { DomainError } from './domain-error';

export class ProductUnavailableError extends DomainError {
  constructor(id: string) {
    super(`Product is not available for new charges: ${id}`, 'PRODUCT_UNAVAILABLE');
  }
}
