import { DomainError } from './domain-error';

export class InsufficientWithdrawalBalanceError extends DomainError {
  constructor() {
    super('Insufficient available balance for withdrawal', 'INSUFFICIENT_WITHDRAWAL_BALANCE');
    this.name = 'InsufficientWithdrawalBalanceError';
  }
}
