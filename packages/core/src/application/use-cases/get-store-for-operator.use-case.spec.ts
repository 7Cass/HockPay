import { describe, expect, it, vi } from 'vitest';
import { GetStoreForOperatorUseCase } from './get-store-for-operator.use-case';
import { ListPaymentsUseCase } from './list-payments.use-case';
import { GetAccountUseCase } from './get-account.use-case';
import { Store } from '../../domain/entities/store.entity';
import { StoreLiveStatus } from '../../domain/value-objects/store-live-status.vo';
import { Environment } from '../../domain/value-objects/environment.vo';
import { OPERATOR_AUDIT_ACTION } from '../../domain/entities/operator-audit-log.entity';
import { StoreNotFoundError } from '../../domain/errors/store-not-found.error';

function storeAt(liveStatus: StoreLiveStatus): Store {
  return Store.reconstitute({
    id: 'store-1',
    merchantId: 'merchant-1',
    name: 'Ateliê Corvo',
    slug: 'atelie-corvo',
    isActive: true,
    liveStatus,
    settlementDays: 30,
    feePercent: 1.5,
    feeFixed: 15,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

function makeHarness(store: Store | null) {
  const appended: any[] = [];
  const repos = {
    storeRepository: {
      findById: vi.fn(async () => store),
      findByIdForUpdate: vi.fn(async () => store),
      update: vi.fn(),
    },
    operatorAuditLogRepository: {
      append: vi.fn(async (log: unknown) => {
        appended.push(log);
      }),
    },
  };

  const unitOfWork = { execute: async (work: any) => work(repos) } as any;

  return { repos, appended, unitOfWork };
}

describe('GetStoreForOperatorUseCase', () => {
  it('records the investigation on the trail, in the same transaction as the read', async () => {
    const { appended, unitOfWork } = makeHarness(storeAt(StoreLiveStatus.APPROVED));

    const result = await new GetStoreForOperatorUseCase(unitOfWork).execute({
      operatorId: 'operator-1',
      storeId: 'store-1',
      requestId: 'req-1',
    });

    expect(result.store.id).toBe('store-1');
    expect(appended).toHaveLength(1);
    expect(appended[0].toObject()).toMatchObject({
      operatorId: 'operator-1',
      action: OPERATOR_AUDIT_ACTION.STORE_INVESTIGATED,
      targetType: 'store',
      targetId: 'store-1',
      requestId: 'req-1',
      // Nothing changed state, so there is no before/after to record, and
      // opening a store is not an action with a financial consequence -- a
      // mandatory reason here would be a ritual nobody reads.
      before: null,
      after: null,
      reason: null,
    });
  });

  it('records one line per opening, with no deduplication', async () => {
    const { appended, unitOfWork } = makeHarness(storeAt(StoreLiveStatus.APPROVED));
    const useCase = new GetStoreForOperatorUseCase(unitOfWork);

    await useCase.execute({ operatorId: 'operator-1', storeId: 'store-1' });
    await useCase.execute({ operatorId: 'operator-1', storeId: 'store-1' });

    // Reloading is another look. Deduplicating would mean reading the trail to
    // decide whether to write it, and an audit line conditional on a query is
    // one somebody can argue should not exist.
    expect(appended).toHaveLength(2);
  });

  it('writes nothing when the store does not exist', async () => {
    const { appended, unitOfWork } = makeHarness(null);

    await expect(
      new GetStoreForOperatorUseCase(unitOfWork).execute({
        operatorId: 'operator-1',
        storeId: 'nope',
      }),
    ).rejects.toThrow(StoreNotFoundError);

    expect(appended).toHaveLength(0);
  });

  it('does not change the store it opens', async () => {
    const store = storeAt(StoreLiveStatus.PENDING);
    const { repos, unitOfWork } = makeHarness(store);

    await new GetStoreForOperatorUseCase(unitOfWork).execute({
      operatorId: 'operator-1',
      storeId: 'store-1',
    });

    expect(repos.storeRepository.update).not.toHaveBeenCalled();
    expect(store.liveStatus).toBe(StoreLiveStatus.PENDING);
  });
});

describe('the sub-reads of an investigation stay pure', () => {
  /**
   * The trail records one line per investigation opened, not one per request.
   * These are the use cases the operator read routes reuse -- they take a
   * repository, not a unit of work, so there is structurally no trail for them
   * to write to.
   */
  it('listing payments writes no trail line', async () => {
    const paymentRepository = {
      list: vi.fn(async () => ({ payments: [], total: 0, page: 1, limit: 20, totalPages: 0 })),
      listByPixChargeIdsAndStoreId: vi.fn(async () => []),
    } as any;

    const result = await new ListPaymentsUseCase(paymentRepository).execute({
      storeId: 'store-1',
      environment: Environment.LIVE,
    });

    expect(result.payments).toEqual([]);
    expect(ListPaymentsUseCase.length).toBe(1);
  });

  it('reading the ledger writes no trail line', async () => {
    const accountRepository = {
      findByStoreIdAndEnvironment: vi.fn(async () => ({
        toObject: () => ({ id: 'acc-1', availableBalance: 0 }),
      })),
    } as any;

    const result = await new GetAccountUseCase(accountRepository).execute({
      storeId: 'store-1',
      environment: Environment.LIVE,
    });

    expect(result.account.id).toBe('acc-1');
    expect(accountRepository.findByStoreIdAndEnvironment).toHaveBeenCalledWith(
      'store-1',
      Environment.LIVE,
    );
  });
});
