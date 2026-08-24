import { DomainError } from './domain-error';

export class InvalidLineItemsError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_LINE_ITEMS');
  }
}
