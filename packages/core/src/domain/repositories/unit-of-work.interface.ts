import { IPaymentRepository } from './payment.repository.interface';
import { IAccountRepository } from './account.repository.interface';
import { ITransactionRepository } from './transaction.repository.interface';
import { IOutboxWriter } from './outbox-writer.repository.interface';
import { IBankAccountRepository } from './bank-account.repository.interface';
import { IReceiptRepository } from './receipt.repository.interface';
import { IStoreRepository } from './store.repository.interface';
import { IRefundRepository } from './refund.repository.interface';
import { ICustomerRepository } from './customer.repository.interface';
import { IPixChargeRepository } from './pix-charge.repository.interface';
import { IWithdrawalRepository } from './withdrawal.repository.interface';
import { IIdempotencyKeyRepository } from './idempotency-key.repository.interface';
import { IMerchantRepository } from './merchant.repository.interface';
import { ICheckoutSessionRepository } from './checkout-session.repository.interface';
import { IPaymentLinkRepository } from './payment-link.repository.interface';
import { IProductRepository } from './product.repository.interface';
import { IRefreshTokenRepositoryPort } from '../../application/ports/refresh-token-repository.port';
import { IOperatorRepository } from './operator.repository.interface';
import { IOperatorRefreshTokenRepository } from './operator-refresh-token.repository.interface';
import { IOperatorAuditLogRepository } from './operator-audit-log.repository.interface';

/**
 * Interface containing transacted repositories.
 */
export interface ITransactedRepositories {
  paymentRepository: IPaymentRepository;
  pixChargeRepository: IPixChargeRepository;
  refundRepository: IRefundRepository;
  accountRepository: IAccountRepository;
  transactionRepository: ITransactionRepository;
  withdrawalRepository: IWithdrawalRepository;
  bankAccountRepository: IBankAccountRepository;
  outboxWriter: IOutboxWriter;
  receiptRepository: IReceiptRepository;
  storeRepository: IStoreRepository;
  merchantRepository: IMerchantRepository;
  refreshTokenRepository: IRefreshTokenRepositoryPort;
  checkoutSessionRepository: ICheckoutSessionRepository;
  paymentLinkRepository: IPaymentLinkRepository;
  customerRepository: ICustomerRepository;
  idempotencyKeyRepository: IIdempotencyKeyRepository;
  productRepository: IProductRepository;
  operatorRepository: IOperatorRepository;
  operatorRefreshTokenRepository: IOperatorRefreshTokenRepository;
  /**
   * Append-only trail. It lives here, and only here, so that a line can only
   * be written inside the transaction that applies the change it describes.
   */
  operatorAuditLogRepository: IOperatorAuditLogRepository;
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
