import { IUnitOfWork, ITransactedRepositories } from "@hockpay/core";
import { PrismaClient } from "@hockpay/database";
import { PaymentRepository } from "./payment.repository";
import { PixChargeRepository } from "./pix-charge.repository";
import { AccountRepository } from "./account.repository";
import { TransactionRepository } from "./transaction.repository";
import { BankAccountRepository } from "./bank-account.repository";
import { OutboxRepository } from "./outbox.repository";
import { ReceiptRepository } from "./receipt.repository";
import { StoreRepository } from "./store.repository";
import { RefundRepository } from "./refund.repository";
import { CustomerRepository } from "./customer.repository";
import { WithdrawalRepository } from "./withdrawal.repository";
import { IdempotencyKeyRepository } from "./idempotency-key.repository";

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
          pixChargeRepository: new PixChargeRepository(tx),
          refundRepository: new RefundRepository(tx),
          accountRepository: new AccountRepository(tx),
          transactionRepository: new TransactionRepository(tx),
          withdrawalRepository: new WithdrawalRepository(tx),
          bankAccountRepository: new BankAccountRepository(tx),
          outboxWriter: new OutboxRepository(tx),
          receiptRepository: new ReceiptRepository(tx),
          storeRepository: new StoreRepository(tx),
          customerRepository: new CustomerRepository(tx),
          idempotencyKeyRepository: new IdempotencyKeyRepository(tx),
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
