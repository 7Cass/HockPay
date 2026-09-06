import { StoreObject } from '../../domain/entities/store.entity';
import { StoreNotFoundError } from '../../domain/errors/store-not-found.error';
import { OperatorDecisionReasonRequiredError } from '../../domain/errors/operator-decision-reason-required.error';
import {
  OPERATOR_AUDIT_ACTION,
  OperatorAuditAction,
  OperatorAuditLog,
} from '../../domain/entities/operator-audit-log.entity';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';

export type LiveEnablementDecision = 'approve' | 'reject' | 'suspend';

export interface IDecideLiveEnablementInput {
  operatorId: string;
  storeId: string;
  decision: LiveEnablementDecision;
  reason: string;
  requestId?: string;
}

export interface IDecideLiveEnablementOutput {
  store: StoreObject;
}

const AUDIT_ACTION: Record<LiveEnablementDecision, OperatorAuditAction> = {
  approve: OPERATOR_AUDIT_ACTION.STORE_LIVE_APPROVED,
  reject: OPERATOR_AUDIT_ACTION.STORE_LIVE_REJECTED,
  suspend: OPERATOR_AUDIT_ACTION.STORE_LIVE_SUSPENDED,
};

/**
 * Use Case: the desk decides a store's LIVE enablement.
 *
 * The first real power of the operator surface, and the first one with a
 * financial consequence: approving is what lets money enter the LIVE ledger.
 * Two rules make it auditable rather than merely logged:
 *
 * - `reason` is mandatory, checked here and not in a DTO. A direct HTTP client
 *   does not go through the screen.
 * - The trail line is written inside the same transaction that changes the
 *   store. Auditing that can fail on its own records a different story from
 *   the one that happened.
 */
export class DecideLiveEnablementUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(input: IDecideLiveEnablementInput): Promise<IDecideLiveEnablementOutput> {
    const reason = input.reason?.trim();

    if (!reason) {
      throw new OperatorDecisionReasonRequiredError(input.decision);
    }

    return this.unitOfWork.execute(async (repos) => {
      const store = await repos.storeRepository.findByIdForUpdate(input.storeId);

      if (!store) {
        throw new StoreNotFoundError(input.storeId);
      }

      const before = { liveStatus: store.liveStatus };

      switch (input.decision) {
        case 'approve':
          store.approveLive(reason);
          break;
        case 'reject':
          store.rejectLive(reason);
          break;
        case 'suspend':
          store.suspendLive(reason);
          break;
      }

      await repos.storeRepository.update(store);

      await repos.operatorAuditLogRepository.append(
        OperatorAuditLog.record({
          operatorId: input.operatorId,
          action: AUDIT_ACTION[input.decision],
          targetType: 'store',
          targetId: store.id,
          before,
          after: { liveStatus: store.liveStatus },
          reason,
          requestId: input.requestId,
        }),
      );

      return { store: store.toObject() };
    });
  }
}
