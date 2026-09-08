import { CommercialTerms, StoreObject } from '../../domain/entities/store.entity';
import { StoreNotFoundError } from '../../domain/errors/store-not-found.error';
import { OperatorDecisionReasonRequiredError } from '../../domain/errors/operator-decision-reason-required.error';
import {
  OPERATOR_AUDIT_ACTION,
  OperatorAuditLog,
} from '../../domain/entities/operator-audit-log.entity';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';

export interface IUpdateCommercialTermsInput extends CommercialTerms {
  operatorId: string;
  storeId: string;
  reason: string;
  requestId?: string;
}

export interface IUpdateCommercialTermsOutput {
  store: StoreObject;
}

/**
 * Use Case: the desk sets a store's commercial condition.
 *
 * The second power of the operator surface, and the only remaining slice that
 * touches the merchant's money. It follows the shape the LIVE decision
 * established, for the same reasons:
 *
 * - `reason` is mandatory, checked here and not in a DTO. A direct HTTP client
 *   does not go through the screen.
 * - The trail line is written inside the same transaction that changes the
 *   store, carrying the whole condition on both sides.
 *
 * The range is not checked here: it lives in the entity, so there is no path
 * to an out-of-range value that skips it.
 */
export class UpdateCommercialTermsUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(input: IUpdateCommercialTermsInput): Promise<IUpdateCommercialTermsOutput> {
    const reason = input.reason?.trim();

    if (!reason) {
      throw new OperatorDecisionReasonRequiredError('commercial-terms');
    }

    return this.unitOfWork.execute(async (repos) => {
      const store = await repos.storeRepository.findByIdForUpdate(input.storeId);

      if (!store) {
        throw new StoreNotFoundError(input.storeId);
      }

      const before = store.commercialTerms();

      store.updateCommercialTerms({
        feePercent: input.feePercent,
        feeFixed: input.feeFixed,
        settlementDays: input.settlementDays,
      });

      await repos.storeRepository.update(store);

      await repos.operatorAuditLogRepository.append(
        OperatorAuditLog.record({
          operatorId: input.operatorId,
          action: OPERATOR_AUDIT_ACTION.STORE_COMMERCIAL_TERMS_CHANGED,
          targetType: 'store',
          targetId: store.id,
          before,
          after: store.commercialTerms(),
          reason,
          requestId: input.requestId,
        }),
      );

      return { store: store.toObject() };
    });
  }
}
