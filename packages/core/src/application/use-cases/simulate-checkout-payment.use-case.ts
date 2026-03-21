import { Payment, PaymentObject } from '../../domain/entities/payment.entity';
import { OutboxEvent } from '../../domain/entities/outbox-event.entity';
import { Environment } from '../../domain/value-objects/environment.vo';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';
import { PaymentNotFoundError } from '../../domain/errors/payment-not-found.error';
import { LiveEnvironmentNotAllowedError } from '../../domain/errors/live-environment-not-allowed.error';
import { InvalidPaymentStatusError } from '../../domain/errors/invalid-payment-status.error';
import { AccountNotFoundError } from '../../domain/errors/account-not-found.error';
import { Transaction, TransactionType } from '../../domain/entities/transaction.entity';

/**
 * Simulation action type.
 */
export type SimulateAction = 'confirm' | 'expire' | 'fail';

/**
 * Input DTO for SimulateCheckoutPaymentUseCase.
 */
export interface ISimulateCheckoutInput {
  paymentId: string;
  action: SimulateAction;
}

/**
 * Output DTO for SimulateCheckoutPaymentUseCase.
 */
export interface ISimulateCheckoutOutput {
  payment: PaymentObject;
}

/**
 * Use Case: Simulate Checkout Payment
 *
 * This use case allows simulating payment actions via payment ID.
 * It only works for payments created in TEST environment.
 *
 * Actions:
 * - confirm: Simulate a successful payment
 * - expire: Simulate payment expiration
 * - fail: Simulate a failed payment
 *
 * Security:
 * - Only works for TEST environment payments
 * - LIVE payments will receive 403 Forbidden
 */
export class SimulateCheckoutPaymentUseCase {
  constructor(
    private readonly unitOfWork: IUnitOfWork,
  ) { }

  async execute(input: ISimulateCheckoutInput): Promise<ISimulateCheckoutOutput> {
    return this.unitOfWork.execute(async (repos) => {
      // 1. Find payment by id
      const payment = await repos.paymentRepository.findById(input.paymentId);

      if (!payment) {
        throw new PaymentNotFoundError(input.paymentId);
      }

      // 2. Validate environment - only TEST payments can be simulated
      if (payment.environment === Environment.LIVE) {
        throw new LiveEnvironmentNotAllowedError();
      }

      // 3. Execute the requested action
      let eventType: string;

      try {
        switch (input.action) {
          case 'confirm':
            payment.confirm();
            eventType = 'payment.confirmed';
            break;

          case 'expire':
            payment.expire();
            eventType = 'payment.expired';
            break;

          case 'fail':
            payment.fail('Simulated failure');
            eventType = 'payment.failed';
            break;

          default:
            throw new Error(`Invalid simulation action: ${input.action}`);
        }
      } catch (error) {
        if (error instanceof InvalidPaymentStatusError) {
          // Payment is not in a valid state for this action
          throw error;
        }
        throw error;
      }

      // Handle account updates and transaction entries for confirmation
      if (input.action === 'confirm') {
        const account = await repos.accountRepository.findByStoreId(payment.storeId);
        if (!account) {
          throw new AccountNotFoundError(payment.storeId);
        }

        // Update pending balance
        account.addToPending(payment.netAmount);
        await repos.accountRepository.update(account);

        // Create Ledger Transaction
        const transaction = Transaction.create({
          accountId: account.id,
          type: TransactionType.PAYMENT_RECEIVED,
          amount: payment.amount,
          fee: payment.fee,
          netAmount: payment.netAmount,
          balanceAfter: account.totalBalance,
          referenceType: 'PAYMENT',
          referenceId: payment.id,
          description: `Pagamento recebido (#${payment.id.split('-')[0]})`,
        });
        await repos.transactionRepository.save(transaction);
      }

      // 4. Persist the payment
      await repos.paymentRepository.update(payment);

      // 5. Create outbox event for webhook notification
      const outboxEvent = OutboxEvent.create({
        aggregateType: 'Payment',
        aggregateId: payment.id,
        eventType,
        payload: payment.toObject() as unknown as Record<string, unknown>,
      });
      await repos.outboxWriter.save(outboxEvent);

      // 6. Return the updated payment
      return {
        payment: payment.toObject(),
      };
    });
  }
}
