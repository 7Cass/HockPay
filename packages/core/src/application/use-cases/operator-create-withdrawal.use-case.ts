import { AccountObject } from '../../domain/entities/account.entity';
import { WithdrawalObject } from '../../domain/entities/withdrawal.entity';
import { AccountNotFoundError } from '../../domain/errors/account-not-found.error';
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
import { CreateWithdrawalUseCase } from './create-withdrawal.use-case';

export interface IOperatorCreateWithdrawalInput {
  operatorId: string;
  storeId: string;
  bankAccountId: string;
  amount: number;
  environment: Environment;
  reason: string;
  requestId?: string;
}

export interface IOperatorCreateWithdrawalOutput {
  withdrawal: WithdrawalObject;
  account: AccountObject;
}

/**
 * Use Case: the desk withdraws on behalf of a store.
 *
 * The other half of closing LIVE for a suspended store. Once the store stops
 * withdrawing on its own, its LIVE balance still belongs to it -- and a locked
 * door with no key is the inverse of the "door into an empty room" that slice 3
 * avoided, not an improvement. This is the key.
 *
 * It is the desk's first power that **writes to the ledger**, and it earns that
 * by not owning a ledger path of its own: the money is moved by
 * `CreateWithdrawalUseCase`, the merchant's own, called inside the transaction
 * where the trail line is written. A second path to the ledger would carry its
 * own idea of limit, fee and balance, and the two would diverge on the first
 * change to either.
 *
 * What it does own is what makes it the desk:
 *
 * - `reason` is mandatory, checked here and not in a DTO, because a direct HTTP
 *   client does not go through the screen.
 * - The trail line carries the balance on both sides. A trail that records that
 *   money moved, without saying from what to what, makes whoever reads it open
 *   the ledger to learn what the line was about.
 * - It does **not** check that the store is suspended. Withdrawing for an
 *   enabled store by ticket is legitimate support, and the balance is the real
 *   constraint: a store that never reached LIVE has no LIVE money to take.
 */
export class OperatorCreateWithdrawalUseCase {
  constructor(
    private readonly unitOfWork: IUnitOfWork,
    private readonly createWithdrawalUseCase: CreateWithdrawalUseCase,
  ) {}

  async execute(input: IOperatorCreateWithdrawalInput): Promise<IOperatorCreateWithdrawalOutput> {
    return this.unitOfWork.execute((repos) => this.executeInTransaction(input, repos));
  }

  async executeInTransaction(
    input: IOperatorCreateWithdrawalInput,
    repos: ITransactedRepositories,
  ): Promise<IOperatorCreateWithdrawalOutput> {
    const reason = input.reason?.trim();

    if (!reason) {
      throw new OperatorDecisionReasonRequiredError('withdrawal');
    }

    // The locking read, and not the plain one: the "before" of the trail has to
    // be the same row the movement below is about. A plain read taken first
    // could see an older version than the locked read that follows it, and the
    // trail would record a balance that was never the one money left from.
    const accountBefore = await repos.accountRepository.findByStoreIdAndEnvironmentForUpdate(
      input.storeId,
      input.environment,
    );

    if (!accountBefore) {
      throw new AccountNotFoundError(input.storeId);
    }

    const before = {
      available: accountBefore.available,
      blocked: accountBefore.blocked,
    };

    const result = await this.createWithdrawalUseCase.executeInTransaction(
      {
        storeId: input.storeId,
        bankAccountId: input.bankAccountId,
        amount: input.amount,
        environment: input.environment,
        requestId: input.requestId,
        operatorInitiated: true,
      },
      repos,
    );

    await repos.operatorAuditLogRepository.append(
      OperatorAuditLog.record({
        operatorId: input.operatorId,
        action: OPERATOR_AUDIT_ACTION.STORE_WITHDRAWAL_CREATED,
        // The desk reasons by store, and the trail does not filter by target --
        // so the target is the store, as it is for the other desk actions, and
        // the withdrawal's identity travels in `after`.
        targetType: 'store',
        targetId: input.storeId,
        before,
        after: {
          available: result.account.available,
          blocked: result.account.blocked,
          withdrawalId: result.withdrawal.id,
          amount: result.withdrawal.amount,
          fee: result.withdrawal.fee,
          netAmount: result.withdrawal.netAmount,
          environment: input.environment,
          bankAccountId: input.bankAccountId,
        },
        reason,
        requestId: input.requestId,
      }),
    );

    return result;
  }
}
