import { DomainError } from './domain-error';

export class WithdrawalNotFoundError extends DomainError {
  constructor(identifier: string) {
    super(`Withdrawal not found: ${identifier}`, 'WITHDRAWAL_NOT_FOUND');
    this.name = 'WithdrawalNotFoundError';
  }
}
