import { PaymentObject } from "../../domain/entities/payment.entity";

export interface PaymentAttemptContext {
  paymentLinkId?: string;
  paymentOrigin?: string;
  attemptNumber?: number;
  attemptCount?: number;
  isLatestAttempt?: boolean;
}

export type PaymentWithAttemptContext = PaymentObject & PaymentAttemptContext;

export function enrichPaymentAttempts(
  payments: PaymentObject[],
): PaymentWithAttemptContext[] {
  const groupedByPixCharge = new Map<string, PaymentObject[]>();

  for (const payment of payments) {
    if (!payment.pixChargeId) continue;
    const current = groupedByPixCharge.get(payment.pixChargeId) ?? [];
    current.push(payment);
    groupedByPixCharge.set(payment.pixChargeId, current);
  }

  const contextByPaymentId = new Map<string, PaymentAttemptContext>();

  for (const group of groupedByPixCharge.values()) {
    const ordered = [...group].sort(compareAttemptsAscending);
    const attemptCount = ordered.length;

    ordered.forEach((payment, index) => {
      contextByPaymentId.set(payment.id, {
        paymentLinkId: getStringMetadata(payment, "paymentLinkId"),
        paymentOrigin: getStringMetadata(payment, "origin"),
        attemptNumber: index + 1,
        attemptCount,
        isLatestAttempt: index === attemptCount - 1,
      });
    });
  }

  return payments.map((payment) => ({
    ...payment,
    ...contextByPaymentId.get(payment.id),
  }));
}

export function enrichPaymentAttempt(
  payment: PaymentObject,
  relatedAttempts: PaymentObject[],
): PaymentWithAttemptContext {
  return (
    enrichPaymentAttempts([
      ...relatedAttempts.filter((attempt) => attempt.id !== payment.id),
      payment,
    ]).find((attempt) => attempt.id === payment.id) ?? payment
  );
}

function compareAttemptsAscending(a: PaymentObject, b: PaymentObject): number {
  const createdDiff =
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  if (createdDiff !== 0) return createdDiff;
  return a.id.localeCompare(b.id);
}

function getStringMetadata(
  payment: PaymentObject,
  key: string,
): string | undefined {
  const value = payment.metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
