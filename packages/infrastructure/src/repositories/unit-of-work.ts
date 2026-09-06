import { IUnitOfWork, ITransactedRepositories } from '@hockpay/core';
import { PrismaClient } from '@hockpay/database';
import { PaymentRepository } from './payment.repository';
import { PixChargeRepository } from './pix-charge.repository';
import { AccountRepository } from './account.repository';
import { TransactionRepository } from './transaction.repository';
import { BankAccountRepository } from './bank-account.repository';
import { OutboxRepository } from './outbox.repository';
import { ReceiptRepository } from './receipt.repository';
import { StoreRepository } from './store.repository';
import { RefundRepository } from './refund.repository';
import { CustomerRepository } from './customer.repository';
import { WithdrawalRepository } from './withdrawal.repository';
import { IdempotencyKeyRepository } from './idempotency-key.repository';
import { MerchantRepository } from './merchant.repository';
import { RefreshTokenRepository } from './refresh-token.repository';
import { CheckoutSessionRepository } from './checkout-session.repository';
import { PaymentLinkRepository } from './payment-link.repository';
import { ProductRepository } from './product.repository';
import { OperatorRepository } from './operator.repository';
import { OperatorRefreshTokenRepository } from './operator-refresh-token.repository';
import { OperatorAuditLogRepository } from './operator-audit-log.repository';

/**
 * Shared implementation of IUnitOfWork using Prisma.
 *
 * It creates a Prisma transaction and provides the transacted
 * repositories to the execute callback.
 */
export class UnitOfWork implements IUnitOfWork {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly checkoutBaseUrl = process.env.CHECKOUT_BASE_URL ?? 'http://localhost:3333',
  ) {}

  async execute<T>(work: (repos: ITransactedRepositories) => Promise<T>): Promise<T> {
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
          merchantRepository: new MerchantRepository(tx),
          refreshTokenRepository: new RefreshTokenRepository(tx),
          checkoutSessionRepository: new CheckoutSessionRepository(tx),
          paymentLinkRepository: new PaymentLinkRepository(tx, this.checkoutBaseUrl),
          customerRepository: new CustomerRepository(tx),
          idempotencyKeyRepository: new IdempotencyKeyRepository(tx),
          productRepository: new ProductRepository(tx),
          operatorRepository: new OperatorRepository(tx),
          operatorRefreshTokenRepository: new OperatorRefreshTokenRepository(tx),
          operatorAuditLogRepository: new OperatorAuditLogRepository(tx),
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
