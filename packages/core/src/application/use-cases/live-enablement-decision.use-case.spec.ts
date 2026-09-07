import { describe, expect, it, vi } from 'vitest';
import { DecideLiveEnablementUseCase } from './decide-live-enablement.use-case';
import { RequestLiveEnablementUseCase } from './request-live-enablement.use-case';
import { Store } from '../../domain/entities/store.entity';
import { StoreLiveStatus } from '../../domain/value-objects/store-live-status.vo';
import { OPERATOR_AUDIT_ACTION } from '../../domain/entities/operator-audit-log.entity';
import { OperatorDecisionReasonRequiredError } from '../../domain/errors/operator-decision-reason-required.error';
import { InvalidStoreLiveStatusTransitionError } from '../../domain/errors/invalid-store-live-status-transition.error';
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
      findByIdAndMerchantId: vi.fn(async (_id: string, merchantId: string) =>
        merchantId === 'merchant-1' ? store : null,
      ),
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

describe('DecideLiveEnablementUseCase', () => {
  it('approves a pending store and records the trail in the same transaction', async () => {
    const store = storeAt(StoreLiveStatus.PENDING);
    const { repos, appended, unitOfWork } = makeHarness(store);

    const result = await new DecideLiveEnablementUseCase(unitOfWork).execute({
      operatorId: 'operator-1',
      storeId: 'store-1',
      decision: 'approve',
      reason: 'documentos conferidos',
      requestId: 'req-1',
    });

    expect(result.store.liveStatus).toBe(StoreLiveStatus.APPROVED);
    expect(repos.storeRepository.update).toHaveBeenCalledTimes(1);

    // The line describes the move, not just its end state.
    expect(appended).toHaveLength(1);
    expect(appended[0].toObject()).toMatchObject({
      operatorId: 'operator-1',
      action: OPERATOR_AUDIT_ACTION.STORE_LIVE_APPROVED,
      targetType: 'store',
      targetId: 'store-1',
      before: { liveStatus: StoreLiveStatus.PENDING },
      after: { liveStatus: StoreLiveStatus.APPROVED },
      reason: 'documentos conferidos',
      requestId: 'req-1',
    });
  });

  it('locks the store instead of reading it unguarded', async () => {
    const { repos, unitOfWork } = makeHarness(storeAt(StoreLiveStatus.PENDING));

    await new DecideLiveEnablementUseCase(unitOfWork).execute({
      operatorId: 'operator-1',
      storeId: 'store-1',
      decision: 'approve',
      reason: 'ok',
    });

    // Two operators deciding at once would otherwise write two lines with the
    // same `before`.
    expect(repos.storeRepository.findByIdForUpdate).toHaveBeenCalledWith('store-1');
  });

  it.each([
    ['reject', OPERATOR_AUDIT_ACTION.STORE_LIVE_REJECTED, StoreLiveStatus.REJECTED],
    ['suspend', OPERATOR_AUDIT_ACTION.STORE_LIVE_SUSPENDED, StoreLiveStatus.SUSPENDED],
  ] as const)('records %s with its own action', async (decision, action, expected) => {
    const from = decision === 'reject' ? StoreLiveStatus.PENDING : StoreLiveStatus.APPROVED;
    const { appended, unitOfWork } = makeHarness(storeAt(from));

    const result = await new DecideLiveEnablementUseCase(unitOfWork).execute({
      operatorId: 'operator-1',
      storeId: 'store-1',
      decision,
      reason: 'motivo registrado',
    });

    expect(result.store.liveStatus).toBe(expected);
    expect(appended[0].toObject()).toMatchObject({ action, before: { liveStatus: from } });
  });

  it.each(['', '   ', undefined as unknown as string])(
    'refuses a decision without a reason (%p), in the use case and not in the screen',
    async (reason) => {
      const { repos, appended, unitOfWork } = makeHarness(storeAt(StoreLiveStatus.PENDING));

      await expect(
        new DecideLiveEnablementUseCase(unitOfWork).execute({
          operatorId: 'operator-1',
          storeId: 'store-1',
          decision: 'approve',
          reason,
        }),
      ).rejects.toBeInstanceOf(OperatorDecisionReasonRequiredError);

      // Nothing changed, and nothing was written to the trail.
      expect(repos.storeRepository.update).not.toHaveBeenCalled();
      expect(appended).toHaveLength(0);
    },
  );

  it('leaves no trail line when the transition is invalid', async () => {
    const store = storeAt(StoreLiveStatus.NOT_REQUESTED);
    const { repos, appended, unitOfWork } = makeHarness(store);

    await expect(
      new DecideLiveEnablementUseCase(unitOfWork).execute({
        operatorId: 'operator-1',
        storeId: 'store-1',
        decision: 'approve',
        reason: 'nunca pediu',
      }),
    ).rejects.toBeInstanceOf(InvalidStoreLiveStatusTransitionError);

    expect(store.liveStatus).toBe(StoreLiveStatus.NOT_REQUESTED);
    expect(repos.storeRepository.update).not.toHaveBeenCalled();
    expect(appended).toHaveLength(0);
  });

  it('does not decide on a store that does not exist', async () => {
    const { appended, unitOfWork } = makeHarness(null);

    await expect(
      new DecideLiveEnablementUseCase(unitOfWork).execute({
        operatorId: 'operator-1',
        storeId: 'store-1',
        decision: 'approve',
        reason: 'motivo',
      }),
    ).rejects.toBeInstanceOf(StoreNotFoundError);

    expect(appended).toHaveLength(0);
  });
});

describe('RequestLiveEnablementUseCase', () => {
  it('moves the store to PENDING without touching the operator trail', async () => {
    const { repos, appended, unitOfWork } = makeHarness(storeAt(StoreLiveStatus.NOT_REQUESTED));

    const result = await new RequestLiveEnablementUseCase(unitOfWork).execute({
      storeId: 'store-1',
      merchantId: 'merchant-1',
    });

    expect(result.store.liveStatus).toBe(StoreLiveStatus.PENDING);
    expect(repos.storeRepository.update).toHaveBeenCalledTimes(1);

    // `operatorId` is mandatory on a trail line, and there is no operator in a
    // merchant's request. A synthetic id would turn the desk's trail into a
    // timeline of anyone.
    expect(appended).toHaveLength(0);
  });

  it('does not let a merchant request for a store they do not own', async () => {
    const { repos, unitOfWork } = makeHarness(storeAt(StoreLiveStatus.NOT_REQUESTED));

    await expect(
      new RequestLiveEnablementUseCase(unitOfWork).execute({
        storeId: 'store-1',
        merchantId: 'merchant-outro',
      }),
    ).rejects.toBeInstanceOf(StoreNotFoundError);

    expect(repos.storeRepository.update).not.toHaveBeenCalled();
  });

  it('does not let a suspended merchant re-request on their own', async () => {
    const { repos, unitOfWork } = makeHarness(storeAt(StoreLiveStatus.SUSPENDED));

    await expect(
      new RequestLiveEnablementUseCase(unitOfWork).execute({
        storeId: 'store-1',
        merchantId: 'merchant-1',
      }),
    ).rejects.toBeInstanceOf(InvalidStoreLiveStatusTransitionError);

    expect(repos.storeRepository.update).not.toHaveBeenCalled();
  });
});
