import { StoreObject } from '../../domain/entities/store.entity';
import { StoreNotFoundError } from '../../domain/errors/store-not-found.error';
import {
  OPERATOR_AUDIT_ACTION,
  OperatorAuditLog,
} from '../../domain/entities/operator-audit-log.entity';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';

export interface IGetStoreForOperatorInput {
  operatorId: string;
  storeId: string;
  requestId?: string;
}

export interface IGetStoreForOperatorOutput {
  store: StoreObject;
}

/**
 * Use Case: the desk opens a store to investigate it.
 *
 * This is the entry point of an investigation, and the one read on the
 * operator surface that writes a trail line. The sub-reads it leads to
 * (payments, ledger, transactions, timeline, webhook deliveries) stay pure.
 *
 * A read that writes is a deliberate exception, and the alternative is worse:
 * a separate `POST /investigate` records only whoever was polite about it --
 * curl skips it, and the screen calls it twice for what is one action. A trail
 * that depends on goodwill is not a trail.
 *
 * There is no deduplication. Reloading records another line. Deduplicating
 * would mean reading the trail to decide whether to write it, and an audit
 * line conditional on a query is one somebody can argue should not exist. The
 * trail is append-only; two identical lines in a row are the truth about what
 * happened.
 *
 * `reason` is not required. Investigating is not an action with a financial
 * consequence, and demanding a reason to open a store would turn the reason
 * requirement into a ritual nobody reads.
 */
export class GetStoreForOperatorUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(input: IGetStoreForOperatorInput): Promise<IGetStoreForOperatorOutput> {
    return this.unitOfWork.execute(async (repos) => {
      const store = await repos.storeRepository.findById(input.storeId);

      if (!store) {
        throw new StoreNotFoundError(input.storeId);
      }

      await repos.operatorAuditLogRepository.append(
        OperatorAuditLog.record({
          operatorId: input.operatorId,
          action: OPERATOR_AUDIT_ACTION.STORE_INVESTIGATED,
          targetType: 'store',
          targetId: store.id,
          requestId: input.requestId,
        }),
      );

      return { store: store.toObject() };
    });
  }
}
