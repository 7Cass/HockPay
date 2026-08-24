import { DomainError } from './domain-error';

export class BankAccountInUseError extends DomainError {
  constructor(identifier: string) {
    super(
      `Bank account has linked withdrawals and cannot be removed: ${identifier}`,
      'BANK_ACCOUNT_IN_USE',
    );
    this.name = 'BankAccountInUseError';
  }
}
