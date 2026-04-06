import { IUnitOfWork, ITransactedRepositories } from "@hockpay/core";
import { PrismaClient } from "@hockpay/database";
import { PaymentRepository } from "./payment.repository";
import { AccountRepository } from "./account.repository";
import { TransactionRepository } from "./transaction.repository";
import { BankAccountRepository } from "./bank-account.repository";
import { OutboxRepository } from "./outbox.repository";
import { ReceiptRepository } from "./receipt.repository";

/**
 * Shared implementation of IUnitOfWork using Prisma.
 *
 * It creates a Prisma transaction and provides the transacted
 * repositories to the execute callback.
 */
export class UnitOfWork implements IUnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  async execute<T>(
    work: (repos: ITransactedRepositories) => Promise<T>,
  ): Promise<T> {
    // We increase timeout slightly for payment confirmations involving many tables.
    return this.prisma.$transaction(
      async (tx) => {
        const repos: ITransactedRepositories = {
          paymentRepository: new PaymentRepository(tx),
          accountRepository: new AccountRepository(tx),
          transactionRepository: new TransactionRepository(tx),
          bankAccountRepository: new BankAccountRepository(tx),
          outboxWriter: new OutboxRepository(tx),
          receiptRepository: new ReceiptRepository(tx),
        };

        return work(repos);
      },
      {
        maxWait: 5000, // 5s max wait to connect to db
        timeout: 10000, // 10s max transaction time
      },
    );
  }
}
