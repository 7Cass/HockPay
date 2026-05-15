import { describe, expect, it } from "vitest";
import { PaymentLinkRepository } from "./payment-link.repository";

describe("PaymentLinkRepository", () => {
  it("calculates conversion from paid links over created links", () => {
    const repository = new PaymentLinkRepository({} as any, "http://localhost:3333");

    const stats = (repository as any).buildStats([
      { status: "PAID", openedAt: null, amount: 10000 },
      { status: "ACTIVE", openedAt: null, amount: 20000 },
      { status: "EXPIRED", openedAt: new Date(), amount: 30000 },
      { status: "CANCELLED", openedAt: null, amount: 40000 },
    ]);

    expect(stats.total).toBe(4);
    expect(stats.paid).toBe(1);
    expect(stats.opened).toBe(1);
    expect(stats.conversionRate).toBe(0.25);
    expect(stats.paidAmount).toBe(10000);
  });

  it("returns zero conversion when there are no links", () => {
    const repository = new PaymentLinkRepository({} as any, "http://localhost:3333");

    const stats = (repository as any).buildStats([]);

    expect(stats.total).toBe(0);
    expect(stats.conversionRate).toBe(0);
  });
});
