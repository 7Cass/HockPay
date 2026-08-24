import { describe, expect, it, vi } from 'vitest';
import {
  calculateDelta,
  GetDashboardOverviewUseCase,
  IDashboardOverviewRepository,
} from './get-dashboard-overview.use-case';
import { Environment } from '../../domain/value-objects/environment.vo';

describe('GetDashboardOverviewUseCase', () => {
  it('builds the overview contract with equivalent previous period and deltas', async () => {
    const repository: IDashboardOverviewRepository = {
      getAccountBalanceByStoreId: vi.fn().mockResolvedValue({
        accountId: 'account-1',
        available: 100_00,
        pending: 20_00,
        blocked: 5_00,
        currency: 'BRL',
      }),
      getBalanceMovement: vi
        .fn()
        .mockResolvedValueOnce({
          available: 18_000,
          pending: 27_000,
        })
        .mockResolvedValueOnce({
          available: 9_000,
          pending: 13_500,
        }),
      getPerformance: vi
        .fn()
        .mockResolvedValueOnce({
          grossVolume: 30_000,
          netVolume: 27_000,
          feeVolume: 3_000,
          salesCount: 3,
        })
        .mockResolvedValueOnce({
          grossVolume: 15_000,
          netVolume: 13_500,
          feeVolume: 1_500,
          salesCount: 3,
        }),
      getConversion: vi.fn().mockResolvedValue({
        paymentApprovalRate: 0.5,
        paymentAttempts: 4,
        approvedPayments: 2,
        linkConversionRate: 0.25,
        linksCreated: 4,
        linksOpened: 3,
        linksPaid: 1,
      }),
      getChart: vi
        .fn()
        .mockResolvedValue([{ date: '2026-05-10', netVolume: 9_000, salesCount: 1 }]),
      getPaymentStatusBreakdown: vi
        .fn()
        .mockResolvedValue([{ status: 'CONFIRMED', count: 2, amount: 20_000 }]),
      getAttention: vi.fn().mockResolvedValue({
        pendingPayments: 1,
        failedPayments: 2,
        expiredPayments: 3,
        refundedPayments: 4,
        failedWebhookDeliveries: 5,
        pendingWebhookDeliveries: 6,
        failedAlertDeliveries: 7,
        pendingAlertDeliveries: 8,
        expiredLinks: 9,
        cancelledLinks: 10,
      }),
      getIntegrationsHealth: vi.fn().mockResolvedValue({
        activeWebhooks: 1,
        activeAlerts: 2,
        failedWebhookDeliveries: 5,
        failedAlertDeliveries: 7,
      }),
      getRecentPayments: vi.fn().mockResolvedValue([
        {
          id: 'payment-1',
          amount: 10_000,
          netAmount: 9_000,
          currency: 'BRL',
          status: 'CONFIRMED',
          origin: 'api',
          createdAt: '2026-05-14T12:00:00.000Z',
        },
      ]),
    };

    const useCase = new GetDashboardOverviewUseCase(repository);
    const result = await useCase.execute({
      storeId: 'store-1',
      startDate: new Date('2026-05-10T00:00:00.000Z'),
      endDate: new Date('2026-05-14T23:59:59.999Z'),
      environment: Environment.LIVE,
    });

    expect(result.period).toEqual({
      startDate: '2026-05-10T00:00:00.000Z',
      endDate: '2026-05-14T23:59:59.999Z',
      previousStartDate: '2026-05-05T00:00:00.000Z',
      previousEndDate: '2026-05-09T23:59:59.999Z',
    });
    expect(result.balance).toMatchObject({
      currency: 'BRL',
      availableDelta: 1,
      pendingDelta: 1,
    });
    expect(result.performance).toMatchObject({
      grossVolume: 30_000,
      netVolume: 27_000,
      feeVolume: 3_000,
      salesCount: 3,
      averageTicket: 10_000,
      grossVolumeDelta: 1,
      netVolumeDelta: 1,
      salesCountDelta: 0,
      averageTicketDelta: 1,
    });
    expect(result.integrationsHealth.environment).toBe('LIVE');
    expect(repository.getPerformance).toHaveBeenNthCalledWith(2, {
      storeId: 'store-1',
      accountId: 'account-1',
      startDate: new Date('2026-05-05T00:00:00.000Z'),
      endDate: new Date('2026-05-09T23:59:59.999Z'),
    });
  });

  it('uses the required zero-base delta semantics', () => {
    expect(calculateDelta(0, 0)).toBe(0);
    expect(calculateDelta(10, 0)).toBeNull();
    expect(calculateDelta(15, 10)).toBe(0.5);
  });
});
