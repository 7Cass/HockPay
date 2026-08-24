import { DomainError } from './domain-error';

export class CustomerIdentityConflictError extends DomainError {
  constructor(
    message: string = 'Provided customer identifiers conflict with existing customer records',
  ) {
    super(message, 'CUSTOMER_IDENTITY_CONFLICT');
  }
}
