import { describe, expect, it } from 'vitest';
import { Store } from './store.entity';
import { StoreLiveStatus } from '../value-objects/store-live-status.vo';
import { InvalidCommercialTermsError } from '../errors/invalid-commercial-terms.error';

function storeWithDefaults(): Store {
  return Store.reconstitute({
    id: 'store-1',
    merchantId: 'merchant-1',
    name: 'Ateliê Corvo',
    slug: 'atelie-corvo',
    isActive: true,
    liveStatus: StoreLiveStatus.NOT_REQUESTED,
    settlementDays: 30,
    feePercent: 1.5,
    feeFixed: 15,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('Store commercial terms', () => {
  it('is born with the defaults the fee policy has always read', () => {
    const store = Store.create({
      merchantId: 'merchant-1',
      name: 'Ateliê Corvo',
      slug: 'atelie-corvo',
    });

    expect(store.commercialTerms()).toEqual({
      feePercent: 1.5,
      feeFixed: 15,
      settlementDays: 30,
    });
  });

  it('moves the three fields together', () => {
    const store = storeWithDefaults();

    store.updateCommercialTerms({ feePercent: 2.9, feeFixed: 39, settlementDays: 2 });

    expect(store.commercialTerms()).toEqual({
      feePercent: 2.9,
      feeFixed: 39,
      settlementDays: 2,
    });
    expect(store.updatedAt.getTime()).toBeGreaterThan(
      new Date('2026-01-01T00:00:00.000Z').getTime(),
    );
  });

  it('accepts the edges of every range, including zero', () => {
    const store = storeWithDefaults();

    // Zero is a real condition -- a demo store pays nothing and settles today.
    expect(() =>
      store.updateCommercialTerms({ feePercent: 0, feeFixed: 0, settlementDays: 0 }),
    ).not.toThrow();
    expect(() =>
      store.updateCommercialTerms({ feePercent: 10, feeFixed: 1000, settlementDays: 90 }),
    ).not.toThrow();
  });

  const outOfRange: Array<
    [string, { feePercent: number; feeFixed: number; settlementDays: number }]
  > = [
    ['fee above the ceiling', { feePercent: 10.1, feeFixed: 15, settlementDays: 30 }],
    ['negative fee', { feePercent: -0.1, feeFixed: 15, settlementDays: 30 }],
    ['fixed fee above the ceiling', { feePercent: 1.5, feeFixed: 1001, settlementDays: 30 }],
    ['negative fixed fee', { feePercent: 1.5, feeFixed: -1, settlementDays: 30 }],
    ['fractional fixed fee', { feePercent: 1.5, feeFixed: 15.5, settlementDays: 30 }],
    ['settlement beyond the horizon', { feePercent: 1.5, feeFixed: 15, settlementDays: 91 }],
    ['negative settlement', { feePercent: 1.5, feeFixed: 15, settlementDays: -1 }],
    ['fractional settlement day', { feePercent: 1.5, feeFixed: 15, settlementDays: 1.5 }],
    ['NaN', { feePercent: Number.NaN, feeFixed: 15, settlementDays: 30 }],
    ['Infinity', { feePercent: Number.POSITIVE_INFINITY, feeFixed: 15, settlementDays: 30 }],
  ];

  it.each(outOfRange)('refuses %s, and leaves the store untouched', (_label, terms) => {
    const store = storeWithDefaults();
    const before = store.commercialTerms();

    expect(() => store.updateCommercialTerms(terms)).toThrow(InvalidCommercialTermsError);

    // Validation runs before any assignment: a refused call is a no-op, not a
    // store left half-updated with the fields that happened to be valid.
    expect(store.commercialTerms()).toEqual(before);
  });

  it('names the offending field in the error, so the desk can fix it', () => {
    const store = storeWithDefaults();

    expect(() =>
      store.updateCommercialTerms({ feePercent: 1.5, feeFixed: 15, settlementDays: 91 }),
    ).toThrow(/settlementDays/);
  });

  it('does not touch the live enablement', () => {
    const store = storeWithDefaults();

    store.updateCommercialTerms({ feePercent: 2.9, feeFixed: 39, settlementDays: 2 });

    expect(store.liveStatus).toBe(StoreLiveStatus.NOT_REQUESTED);
    expect(store.liveStatusChangedAt).toBeUndefined();
  });
});
