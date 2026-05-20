import { describe, expect, it, vi } from "vitest";
import { AccountRepository } from "./account.repository";

describe("AccountRepository", () => {
  it("selects only settlement-eligible accounts with pending confirmed payments", async () => {
    const cutoffDate = new Date("2026-05-20T00:00:00.000Z");
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: "account-1",
          store_id: "store-1",
          available: 100,
          pending: 7855,
          blocked: 0,
          currency: "BRL",
          updated_at: new Date("2026-05-19T00:00:00.000Z"),
        },
      ]),
    };
    const repository = new AccountRepository(prisma as any);

    const accounts = await repository.findWithPendingBalance(cutoffDate);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw.mock.calls[0][1]).toBe(cutoffDate);
    expect(String(prisma.$queryRaw.mock.calls[0][0].join(" "))).toContain(
      "p.status = 'CONFIRMED'",
    );
    expect(accounts).toHaveLength(1);
    expect(accounts[0].storeId).toBe("store-1");
    expect(accounts[0].pending).toBe(7855);
  });
});
