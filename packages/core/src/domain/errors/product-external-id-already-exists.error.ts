import { DomainError } from './domain-error';

export class ProductExternalIdAlreadyExistsError extends DomainError {
  constructor(externalId: string) {
    super(
      `Product with externalId "${externalId}" already exists`,
      'PRODUCT_EXTERNAL_ID_ALREADY_EXISTS',
    );
  }
}
