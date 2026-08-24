import { DomainError } from './domain-error';

export class ReceiptAlreadyCancelledError extends DomainError {
  constructor() {
    super('Receipt is already cancelled', 'RECEIPT_ALREADY_CANCELLED');
  }
}
