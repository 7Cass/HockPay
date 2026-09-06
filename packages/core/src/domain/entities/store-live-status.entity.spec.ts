import { describe, expect, it } from 'vitest';
import { Store } from './store.entity';
import { StoreLiveStatus } from '../value-objects/store-live-status.vo';
import { InvalidStoreLiveStatusTransitionError } from '../errors/invalid-store-live-status-transition.error';

function newStore(): Store {
  return Store.create({ merchantId: 'merchant-1', name: 'Ateliê Corvo', slug: 'atelie-corvo' });
}

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

describe('Store live enablement', () => {
  it('is born asking for nothing, and usable anyway', () => {
    const store = newStore();

    expect(store.liveStatus).toBe(StoreLiveStatus.NOT_REQUESTED);
    expect(store.isLiveEnabled()).toBe(false);
    // The promise of the product: charging in TEST needs no approval at all.
    expect(store.canBeUsed()).toBe(true);
  });

  it('only counts APPROVED as enabled', () => {
    const enabled = [StoreLiveStatus.APPROVED];

    for (const status of Object.values(StoreLiveStatus)) {
      expect(storeAt(status).isLiveEnabled()).toBe(enabled.includes(status));
    }
  });

  it('never makes a live status change the reason to stop using TEST', () => {
    for (const status of Object.values(StoreLiveStatus)) {
      expect(storeAt(status).canBeUsed()).toBe(true);
    }
  });

  describe('transitions', () => {
    it('lets a merchant ask from NOT_REQUESTED and from REJECTED', () => {
      for (const from of [StoreLiveStatus.NOT_REQUESTED, StoreLiveStatus.REJECTED]) {
        const store = storeAt(from);
        store.requestLive();
        expect(store.liveStatus).toBe(StoreLiveStatus.PENDING);
      }
    });

    it('does not let a suspended merchant re-request on their own', () => {
      const store = storeAt(StoreLiveStatus.SUSPENDED);

      expect(() => store.requestLive()).toThrow(InvalidStoreLiveStatusTransitionError);
      expect(store.liveStatus).toBe(StoreLiveStatus.SUSPENDED);
    });

    it('approves from PENDING and reinstates from SUSPENDED', () => {
      for (const from of [StoreLiveStatus.PENDING, StoreLiveStatus.SUSPENDED]) {
        const store = storeAt(from);
        store.approveLive('documentos conferidos');
        expect(store.liveStatus).toBe(StoreLiveStatus.APPROVED);
        expect(store.liveStatusReason).toBe('documentos conferidos');
        expect(store.liveStatusChangedAt).toBeInstanceOf(Date);
      }
    });

    it('does not approve a store that never asked', () => {
      const store = storeAt(StoreLiveStatus.NOT_REQUESTED);

      expect(() => store.approveLive('porque sim')).toThrow(InvalidStoreLiveStatusTransitionError);
      expect(store.liveStatus).toBe(StoreLiveStatus.NOT_REQUESTED);
    });

    it('rejects only from PENDING', () => {
      const pending = storeAt(StoreLiveStatus.PENDING);
      pending.rejectLive('CNPJ nao confere');
      expect(pending.liveStatus).toBe(StoreLiveStatus.REJECTED);
      expect(pending.liveStatusReason).toBe('CNPJ nao confere');

      expect(() => storeAt(StoreLiveStatus.APPROVED).rejectLive('tarde demais')).toThrow(
        InvalidStoreLiveStatusTransitionError,
      );
    });

    it('suspends only from APPROVED', () => {
      const approved = storeAt(StoreLiveStatus.APPROVED);
      approved.suspendLive('padrao de fraude');
      expect(approved.liveStatus).toBe(StoreLiveStatus.SUSPENDED);
      expect(approved.isLiveEnabled()).toBe(false);

      expect(() => storeAt(StoreLiveStatus.PENDING).suspendLive('ainda nem abriu')).toThrow(
        InvalidStoreLiveStatusTransitionError,
      );
    });

    it('replaces the reason on each decision instead of keeping a history', () => {
      const store = storeAt(StoreLiveStatus.PENDING);

      store.approveLive('aprovada na analise');
      store.suspendLive('estorno acima do normal');

      // The history is the audit trail, not this field.
      expect(store.liveStatusReason).toBe('estorno acima do normal');
    });
  });
});
