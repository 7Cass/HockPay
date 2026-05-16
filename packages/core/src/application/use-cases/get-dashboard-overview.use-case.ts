import { AccountNotFoundError } from "../../domain/errors/account-not-found.error";
import { Environment } from "../../domain/value-objects/environment.vo";

export type DashboardPaymentOrigin =
  | "api"
  | "checkout"
  | "payment_link"
  | "unknown";

export interface DashboardOverviewDto {
  period: {
    startDate: string;
    endDate: string;
    previousStartDate: string;
    previousEndDate: string;
  };
  balance: {
    available: number;
    pending: number;
    blocked: number;
    currency: string;
    availableDelta: number | null;
    pendingDelta: number | null;
  };
  performance: {
    grossVolume: number;
    netVolume: number;
    feeVolume: number;
    salesCount: number;
    averageTicket: number;
    grossVolumeDelta: number | null;
    netVolumeDelta: number | null;
    salesCountDelta: number | null;
    averageTicketDelta: number | null;
  };
  conversion: {
    paymentApprovalRate: number;
    paymentAttempts: number;
    approvedPayments: number;
    linkConversionRate: number;
    linksCreated: number;
    linksOpened: number;
    linksPaid: number;
  };
  chart: Array<{
    date: string;
    netVolume: number;
    salesCount: number;
  }>;
  paymentStatusBreakdown: Array<{
    status: string;
    count: number;
    amount: number;
  }>;
  attention: {
    pendingPayments: number;
    failedPayments: number;
    expiredPayments: number;
    refundedPayments: number;
    failedWebhookDeliveries: number;
    pendingWebhookDeliveries: number;
    failedAlertDeliveries: number;
    pendingAlertDeliveries: number;
    expiredLinks: number;
    cancelledLinks: number;
  };
  integrationsHealth: {
    activeWebhooks: number;
    activeAlerts: number;
    failedWebhookDeliveries: number;
    failedAlertDeliveries: number;
    environment: "TEST" | "LIVE";
  };
  recentPayments: Array<{
    id: string;
    amount: number;
    netAmount: number;
    currency: string;
    status: string;
    origin: DashboardPaymentOrigin;
    description?: string;
    payerName?: string;
    payerEmail?: string;
    customerId?: string;
    createdAt: string;
  }>;
}

export interface DashboardAccountBalanceProjection {
  accountId: string;
  available: number;
  pending: number;
  blocked: number;
  currency: string;
}

export interface DashboardPerformanceProjection {
  grossVolume: number;
  netVolume: number;
  feeVolume: number;
  salesCount: number;
}

export interface DashboardBalanceMovementProjection {
  available: number;
  pending: number;
}

export interface DashboardDateRangeInput {
  storeId: string;
  accountId: string;
  startDate: Date;
  endDate: Date;
}

export interface IDashboardOverviewRepository {
  getAccountBalanceByStoreId(
    storeId: string,
  ): Promise<DashboardAccountBalanceProjection | null>;
  getPerformance(
    input: DashboardDateRangeInput,
  ): Promise<DashboardPerformanceProjection>;
  getBalanceMovement(
    input: DashboardDateRangeInput,
  ): Promise<DashboardBalanceMovementProjection>;
  getChart(
    input: DashboardDateRangeInput,
  ): Promise<DashboardOverviewDto["chart"]>;
  getConversion(
    input: Omit<DashboardDateRangeInput, "accountId">,
  ): Promise<DashboardOverviewDto["conversion"]>;
  getPaymentStatusBreakdown(
    input: Omit<DashboardDateRangeInput, "accountId">,
  ): Promise<DashboardOverviewDto["paymentStatusBreakdown"]>;
  getAttention(
    input: Omit<DashboardDateRangeInput, "accountId">,
  ): Promise<DashboardOverviewDto["attention"]>;
  getIntegrationsHealth(
    input: Omit<DashboardDateRangeInput, "accountId">,
  ): Promise<Omit<DashboardOverviewDto["integrationsHealth"], "environment">>;
  getRecentPayments(
    storeId: string,
    limit: number,
  ): Promise<DashboardOverviewDto["recentPayments"]>;
}

export interface GetDashboardOverviewInput {
  storeId: string;
  startDate: Date;
  endDate: Date;
  environment?: Environment | "TEST" | "LIVE";
}

export class GetDashboardOverviewUseCase {
  constructor(
    private readonly dashboardOverviewRepository: IDashboardOverviewRepository,
  ) {}

  async execute(
    input: GetDashboardOverviewInput,
  ): Promise<DashboardOverviewDto> {
    const { previousStartDate, previousEndDate } = calculatePreviousPeriod(
      input.startDate,
      input.endDate,
    );

    const balance =
      await this.dashboardOverviewRepository.getAccountBalanceByStoreId(
        input.storeId,
      );

    if (!balance) {
      throw new AccountNotFoundError(input.storeId);
    }

    const currentRange = {
      storeId: input.storeId,
      accountId: balance.accountId,
      startDate: input.startDate,
      endDate: input.endDate,
    };
    const previousRange = {
      ...currentRange,
      startDate: previousStartDate,
      endDate: previousEndDate,
    };

    const [
      currentPerformance,
      previousPerformance,
      currentBalanceMovement,
      previousBalanceMovement,
      conversion,
      chart,
      paymentStatusBreakdown,
      attention,
      integrationsHealth,
      recentPayments,
    ] = await Promise.all([
      this.dashboardOverviewRepository.getPerformance(currentRange),
      this.dashboardOverviewRepository.getPerformance(previousRange),
      this.dashboardOverviewRepository.getBalanceMovement(currentRange),
      this.dashboardOverviewRepository.getBalanceMovement(previousRange),
      this.dashboardOverviewRepository.getConversion(currentRange),
      this.dashboardOverviewRepository.getChart(currentRange),
      this.dashboardOverviewRepository.getPaymentStatusBreakdown(currentRange),
      this.dashboardOverviewRepository.getAttention(currentRange),
      this.dashboardOverviewRepository.getIntegrationsHealth(currentRange),
      this.dashboardOverviewRepository.getRecentPayments(input.storeId, 10),
    ]);

    const currentAverageTicket = calculateAverageTicket(
      currentPerformance.grossVolume,
      currentPerformance.salesCount,
    );
    const previousAverageTicket = calculateAverageTicket(
      previousPerformance.grossVolume,
      previousPerformance.salesCount,
    );

    return {
      period: {
        startDate: input.startDate.toISOString(),
        endDate: input.endDate.toISOString(),
        previousStartDate: previousStartDate.toISOString(),
        previousEndDate: previousEndDate.toISOString(),
      },
      balance: {
        available: balance.available,
        pending: balance.pending,
        blocked: balance.blocked,
        currency: balance.currency,
        availableDelta: calculateDelta(
          currentBalanceMovement.available,
          previousBalanceMovement.available,
        ),
        pendingDelta: calculateDelta(
          currentBalanceMovement.pending,
          previousBalanceMovement.pending,
        ),
      },
      performance: {
        grossVolume: currentPerformance.grossVolume,
        netVolume: currentPerformance.netVolume,
        feeVolume: currentPerformance.feeVolume,
        salesCount: currentPerformance.salesCount,
        averageTicket: currentAverageTicket,
        grossVolumeDelta: calculateDelta(
          currentPerformance.grossVolume,
          previousPerformance.grossVolume,
        ),
        netVolumeDelta: calculateDelta(
          currentPerformance.netVolume,
          previousPerformance.netVolume,
        ),
        salesCountDelta: calculateDelta(
          currentPerformance.salesCount,
          previousPerformance.salesCount,
        ),
        averageTicketDelta: calculateDelta(
          currentAverageTicket,
          previousAverageTicket,
        ),
      },
      conversion,
      chart,
      paymentStatusBreakdown,
      attention,
      integrationsHealth: {
        ...integrationsHealth,
        environment: input.environment ?? Environment.TEST,
      },
      recentPayments,
    };
  }
}

export function calculatePreviousPeriod(
  startDate: Date,
  endDate: Date,
): { previousStartDate: Date; previousEndDate: Date } {
  const durationMs = endDate.getTime() - startDate.getTime();
  const previousEndDate = new Date(startDate.getTime() - 1);
  const previousStartDate = new Date(previousEndDate.getTime() - durationMs);

  return { previousStartDate, previousEndDate };
}

export function calculateDelta(
  currentValue: number,
  previousValue: number,
): number | null {
  if (previousValue === 0) {
    return currentValue === 0 ? 0 : null;
  }

  return (currentValue - previousValue) / previousValue;
}

function calculateAverageTicket(
  grossVolume: number,
  salesCount: number,
): number {
  return salesCount > 0 ? Math.round(grossVolume / salesCount) : 0;
}
