import { DomainError } from './domain-error';

export class BankAccountNotVerifiedError extends DomainError {
  constructor(bankAccountId: string) {
    super(`Bank account is not verified: ${bankAccountId}`, 'BANK_ACCOUNT_NOT_VERIFIED');
    this.name = 'BankAccountNotVerifiedError';
  }
}
