import { StoreLiveStatus } from '../../domain/value-objects/store-live-status.vo';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export interface IListStoresForOperatorInput {
  liveStatus?: StoreLiveStatus;
  limit?: number;
  offset?: number;
}

/**
 * What the desk sees about a store.
 *
 * This is deliberately the smallest set a decision needs: no ledger, no
 * payment, no webhook secret and no API key. Reading a merchant's data to
 * investigate a ticket is a slice of its own, and the parent PRD is explicit
 * that the operator never reads a secret at all.
 */
export interface OperatorStoreListItem {
  id: string;
  merchantId: string;
  name: string;
  slug: string;
  liveStatus: StoreLiveStatus;
  liveStatusReason?: string;
  liveStatusChangedAt?: Date;
  createdAt: Date;
}

export interface IListStoresForOperatorOutput {
  data: OperatorStoreListItem[];
  limit: number;
  offset: number;
}

/**
 * Use Case: the LIVE enablement queue.
 */
export class ListStoresForOperatorUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(input: IListStoresForOperatorInput = {}): Promise<IListStoresForOperatorOutput> {
    const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = Math.max(input.offset ?? 0, 0);

    const stores = await this.unitOfWork.execute((repos) =>
      repos.storeRepository.listByLiveStatus({
        liveStatus: input.liveStatus,
        limit,
        offset,
      }),
    );

    return {
      data: stores.map((store) => ({
        id: store.id,
        merchantId: store.merchantId,
        name: store.name,
        slug: store.slug,
        liveStatus: store.liveStatus,
        liveStatusReason: store.liveStatusReason,
        liveStatusChangedAt: store.liveStatusChangedAt,
        createdAt: store.createdAt,
      })),
      limit,
      offset,
    };
  }
}
