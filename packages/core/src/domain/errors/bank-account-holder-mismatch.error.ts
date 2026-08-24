import { DomainError } from './domain-error';

export class BankAccountHolderMismatchError extends DomainError {
  constructor(holderDocument: string, merchantDocument: string) {
    super(
      `Holder document (${holderDocument}) does not match merchant document (${merchantDocument}). Third-party accounts are not allowed.`,
      'BANK_ACCOUNT_HOLDER_MISMATCH',
    );
  }
}
