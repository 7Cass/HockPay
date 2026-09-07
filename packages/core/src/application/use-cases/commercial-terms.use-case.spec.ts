import { describe, expect, it, vi } from 'vitest';
import { UpdateCommercialTermsUseCase } from './update-commercial-terms.use-case';
import { CreatePaymentUseCase } from './create-payment.use-case';
import { FeePolicy } from '../services/fee-policy.service';
import { Store } from '../../domain/entities/store.entity';
import { StoreLiveStatus } from '../../domain/value-objects/store-live-status.vo';
import { Environment } from '../../domain/value-objects/environment.vo';
import { OPERATOR_AUDIT_ACTION } from '../../domain/entities/operator-audit-log.entity';
import { OperatorDecisionReasonRequiredError } from '../../domain/errors/operator-decision-reason-required.error';
import { InvalidCommercialTermsError } from '../../domain/errors/invalid-commercial-terms.error';
import { StoreNotFoundError } from '../../domain/errors/store-not-found.error';

function storeWithDefaults(): Store {
  return Store.reconstitute({
    id: 'store-1',
    merchantId: 'merchant-1',
    name: 'Ateliê Corvo',
    slug: 'atelie-corvo',
    isActive: true,
    liveStatus: StoreLiveStatus.APPROVED,
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

describe('UpdateCommercialTermsUseCase', () => {
  it('sets the condition and records the whole object on both sides of the trail', async () => {
    const store = storeWithDefaults();
    const { repos, appended, unitOfWork } = makeHarness(store);

    const result = await new UpdateCommercialTermsUseCase(unitOfWork).execute({
      operatorId: 'operator-1',
      storeId: 'store-1',
      feePercent: 2.9,
      feeFixed: 39,
      settlementDays: 2,
      reason: 'condicao negociada no plano anual',
      requestId: 'req-1',
    });

    expect(result.store.feePercent).toBe(2.9);
    expect(result.store.feeFixed).toBe(39);
    expect(result.store.settlementDays).toBe(2);
    expect(repos.storeRepository.update).toHaveBeenCalledTimes(1);

    // The line carries the whole condition, not just the fields that moved:
    // reading it should not require reconstructing the rest from older lines.
    expect(appended).toHaveLength(1);
    expect(appended[0].toObject()).toMatchObject({
      operatorId: 'operator-1',
      action: OPERATOR_AUDIT_ACTION.STORE_COMMERCIAL_TERMS_CHANGED,
      targetType: 'store',
      targetId: 'store-1',
      before: { feePercent: 1.5, feeFixed: 15, settlementDays: 30 },
      after: { feePercent: 2.9, feeFixed: 39, settlementDays: 2 },
      reason: 'condicao negociada no plano anual',
      requestId: 'req-1',
    });
  });

  it('refuses a change with no reason, before opening a transaction', async () => {
    const store = storeWithDefaults();
    const { repos, unitOfWork } = makeHarness(store);

    await expect(
      new UpdateCommercialTermsUseCase(unitOfWork).execute({
        operatorId: 'operator-1',
        storeId: 'store-1',
        feePercent: 2.9,
        feeFixed: 39,
        settlementDays: 2,
        reason: '   ',
      }),
    ).rejects.toThrow(OperatorDecisionReasonRequiredError);

    // A direct HTTP client does not go through the DTO's screen, so the rule
    // has to hold here -- and nothing may have been written on the way out.
    expect(repos.storeRepository.update).not.toHaveBeenCalled();
    expect(store.commercialTerms()).toEqual({
      feePercent: 1.5,
      feeFixed: 15,
      settlementDays: 30,
    });
  });

  it('refuses an out-of-range value and writes no trail line', async () => {
    const store = storeWithDefaults();
    const { repos, appended, unitOfWork } = makeHarness(store);

    await expect(
      new UpdateCommercialTermsUseCase(unitOfWork).execute({
        operatorId: 'operator-1',
        storeId: 'store-1',
        feePercent: 150,
        feeFixed: 15,
        settlementDays: 30,
        reason: 'erro de digitacao',
      }),
    ).rejects.toThrow(InvalidCommercialTermsError);

    expect(repos.storeRepository.update).not.toHaveBeenCalled();
    expect(appended).toHaveLength(0);
  });

  it('refuses a store that does not exist', async () => {
    const { unitOfWork } = makeHarness(null);

    await expect(
      new UpdateCommercialTermsUseCase(unitOfWork).execute({
        operatorId: 'operator-1',
        storeId: 'nope',
        feePercent: 2.9,
        feeFixed: 39,
        settlementDays: 2,
        reason: 'qualquer',
      }),
    ).rejects.toThrow(StoreNotFoundError);
  });

  it('never changes the condition without a trail line', async () => {
    const store = storeWithDefaults();
    const { repos, appended, unitOfWork } = makeHarness(store);
    const useCase = new UpdateCommercialTermsUseCase(unitOfWork);

    await useCase.execute({
      operatorId: 'operator-1',
      storeId: 'store-1',
      feePercent: 2.9,
      feeFixed: 39,
      settlementDays: 2,
      reason: 'primeira',
    });
    await useCase.execute({
      operatorId: 'operator-1',
      storeId: 'store-1',
      feePercent: 3.5,
      feeFixed: 49,
      settlementDays: 7,
      reason: 'segunda',
    });

    expect(repos.storeRepository.update).toHaveBeenCalledTimes(2);
    expect(appended).toHaveLength(2);
  });
});

describe('commercial terms are not retroactive', () => {
  /**
   * The property that matters most in this slice, and the one the parent PRD
   * states outright: changing a fee does not rewrite what was already charged.
   *
   * This wires the real FeePolicy and the real Store so the proof is the
   * production path, not a mock agreeing with itself.
   */
  function makeCharger(store: Store) {
    const saved: any[] = [];
    const repos = {
      paymentRepository: {
        externalIdExists: vi.fn().mockResolvedValue(false),
        save: vi.fn(async (payment: any) => {
          saved.push(payment);
        }),
      },
      pixChargeRepository: { save: vi.fn() },
      customerRepository: {
        findByExternalId: vi.fn(),
        findByDocument: vi.fn(),
        save: vi.fn(),
        update: vi.fn(),
      },
      storeRepository: { findById: vi.fn(async () => store) },
      outboxWriter: { save: vi.fn() },
    };

    const useCase = new CreatePaymentUseCase(
      { execute: vi.fn((work: any) => work(repos)) } as any,
      {
        generate: vi.fn().mockResolvedValue({
          qrCodeBase64: 'qr',
          copyPaste: 'pix',
          txId: 'txid',
        }),
      } as any,
      { scheduleExpiration: vi.fn() } as any,
      new FeePolicy(),
      'test@hockpay.com',
    );

    return { useCase, saved };
  }

  it('leaves an already charged payment untouched, and applies the new terms forward', async () => {
    const store = storeWithDefaults();
    const { useCase, saved } = makeCharger(store);

    const before = await useCase.execute({
      storeId: 'store-1',
      amount: 10_000,
      description: 'Antes da mudanca',
      customer: { name: 'Visitante', email: 'guest@example.com' },
      environment: Environment.TEST,
    });

    // 1.5% of 100.00 plus 15 cents.
    expect(before.payment.fee).toBe(165);
    expect(before.payment.netAmount).toBe(9835);

    const { unitOfWork } = makeHarness(store);
    await new UpdateCommercialTermsUseCase(unitOfWork).execute({
      operatorId: 'operator-1',
      storeId: 'store-1',
      feePercent: 5,
      feeFixed: 100,
      settlementDays: 2,
      reason: 'condicao renegociada',
    });

    // The stored payment is a snapshot. Nothing recomputes it.
    const stored = saved[0].toObject();
    expect(stored.fee).toBe(165);
    expect(stored.netAmount).toBe(9835);

    const after = await useCase.execute({
      storeId: 'store-1',
      amount: 10_000,
      description: 'Depois da mudanca',
      customer: { name: 'Visitante', email: 'guest@example.com' },
      environment: Environment.TEST,
    });

    // 5% of 100.00 plus 100 cents. The change is real, it just starts here.
    expect(after.payment.fee).toBe(600);
    expect(after.payment.netAmount).toBe(9400);
    expect(saved[0].toObject().fee).toBe(165);
  });
});
