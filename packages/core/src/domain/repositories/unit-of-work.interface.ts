import { IPaymentRepository } from "./payment.repository.interface";
import { IAccountRepository } from "./account.repository.interface";
import { ITransactionRepository } from "./transaction.repository.interface";
import { IOutboxWriter } from "./outbox-writer.repository.interface";
import { IBankAccountRepository } from "./bank-account.repository.interface";
import { IReceiptRepository } from "./receipt.repository.interface";
import { IStoreRepository } from "./store.repository.interface";

/**
 * Interface containing transacted repositories.
 */
export interface ITransactedRepositories {
  paymentRepository: IPaymentRepository;
  accountRepository: IAccountRepository;
  transactionRepository: ITransactionRepository;
  bankAccountRepository: IBankAccountRepository;
  outboxWriter: IOutboxWriter;
  receiptRepository: IReceiptRepository;
  storeRepository: IStoreRepository;
}

/**
 * Unit of Work interface
 *
 * Provides a transactional boundary for operations across multiple repositories.
 * The provided callback will be executed securely within a database transaction.
 */
export interface IUnitOfWork {
  execute<T>(work: (repos: ITransactedRepositories) => Promise<T>): Promise<T>;
}
