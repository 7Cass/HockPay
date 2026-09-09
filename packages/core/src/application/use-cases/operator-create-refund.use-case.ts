import { PaymentObject } from '../../domain/entities/payment.entity';
import { RefundObject } from '../../domain/entities/refund.entity';
import { PaymentNotFoundError } from '../../domain/errors/payment-not-found.error';
import { LiveEnvironmentNotAllowedError } from '../../domain/errors/live-environment-not-allowed.error';
import { OperatorDecisionReasonRequiredError } from '../../domain/errors/operator-decision-reason-required.error';
import {
  OPERATOR_AUDIT_ACTION,
  OperatorAuditLog,
} from '../../domain/entities/operator-audit-log.entity';
import {
  ITransactedRepositories,
  IUnitOfWork,
} from '../../domain/repositories/unit-of-work.interface';
import { Environment } from '../../domain/value-objects/environment.vo';
import { CreateRefundUseCase } from './create-refund.use-case';

export interface IOperatorCreateRefundInput {
  operatorId: string;
  storeId: string;
  paymentId: string;
  amount: number;
  /**
   * The ledger the desk means to touch, stated rather than inferred.
   *
   * It is not the source of truth -- the payment's own environment is -- and
   * that is exactly why it is asked for: a mismatch is refused instead of
   * silently followed. The desk investigates many stores in both ledgers, and
   * "I meant the other one" is the mistake this field exists to catch.
   */
  environment: Environment;
  reason: string;
  requestId?: string;
}

export interface IOperatorCreateRefundOutput {
  refund: RefundObject;
  payment: PaymentObject;
}

/**
 * Use Case: the desk refunds on behalf of a store.
 *
 * The companion of `OperatorCreateWithdrawalUseCase`, and it follows the same
 * shape for the same reasons: the money is moved by the merchant's own
 * `CreateRefundUseCase`, called inside the transaction that writes the trail,
 * and `reason` is mandatory here rather than in a DTO.
 *
 * The `environment` it takes is a confirmation, not an input: the payment
 * already knows which ledger it belongs to, and a desk that says otherwise is
 * refused. Reading the environment off the request and *following* it is what
 * would be wrong; reading it and *checking* it is what keeps a refund from
 * landing in a ledger the operator was not looking at.
 */
export class OperatorCreateRefundUseCase {
  constructor(
    private readonly unitOfWork: IUnitOfWork,
    private readonly createRefundUseCase: CreateRefundUseCase,
  ) {}

  async execute(input: IOperatorCreateRefundInput): Promise<IOperatorCreateRefundOutput> {
    return this.unitOfWork.execute((repos) => this.executeInTransaction(input, repos));
  }

  async executeInTransaction(
    input: IOperatorCreateRefundInput,
    repos: ITransactedRepositories,
  ): Promise<IOperatorCreateRefundOutput> {
    const reason = input.reason?.trim();

    if (!reason) {
      throw new OperatorDecisionReasonRequiredError('refund');
    }

    // Locked, for the same reason the withdrawal locks the account first: the
    // trail's "before" must be the row the refund is about, not an earlier
    // version of it.
    const paymentBefore = await repos.paymentRepository.findByIdAndStoreIdForUpdate(
      input.paymentId,
      input.storeId,
    );

    if (!paymentBefore) {
      throw new PaymentNotFoundError(input.paymentId);
    }

    if (input.environment !== paymentBefore.environment) {
      throw new LiveEnvironmentNotAllowedError();
    }

    const before = {
      status: paymentBefore.status,
      totalRefunded: paymentBefore.totalRefunded,
      environment: paymentBefore.environment,
    };

    const result = await this.createRefundUseCase.executeInTransaction(
      {
        storeId: input.storeId,
        paymentId: input.paymentId,
        amount: input.amount,
        reason,
        requestId: input.requestId,
        // The payment's own environment is what the refund answers to, and the
        // caller check below it is satisfied by construction: the desk is not a
        // TEST session reaching into LIVE, it is the desk.
        callerEnvironment: paymentBefore.environment,
        operatorInitiated: true,
      },
      repos,
    );

    await repos.operatorAuditLogRepository.append(
      OperatorAuditLog.record({
        operatorId: input.operatorId,
        action: OPERATOR_AUDIT_ACTION.STORE_REFUND_CREATED,
        targetType: 'store',
        targetId: input.storeId,
        before,
        after: {
          status: result.payment.status,
          totalRefunded: result.payment.totalRefunded,
          environment: paymentBefore.environment,
          refundId: result.refund.id,
          paymentId: input.paymentId,
          amount: result.refund.amount,
          feeRefunded: result.refund.feeRefunded,
        },
        reason,
        requestId: input.requestId,
      }),
    );

    return result;
  }
}
