import { describe, expect, it, vi } from "vitest";
import { WithdrawalRepository } from "./withdrawal.repository";

describe("WithdrawalRepository", () => {
  it("locks and reconstitutes a withdrawal by id", async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: "withdrawal-1",
          accountId: "account-1",
          bankAccountId: "bank-1",
          amount: 10_000,
          fee: 199,
          netAmount: 9_801,
          status: "PROCESSING",
          pixE2eId: null,
          paidAt: null,
          failedReason: null,
          processingAttempts: 1,
          nextProcessAt: null,
          lastProcessingError: null,
          createdAt: new Date("2026-05-18T11:00:00.000Z"),
          updatedAt: new Date("2026-05-18T12:00:00.000Z"),
        },
      ]),
    };
    const repository = new WithdrawalRepository(prisma as any);

    const withdrawal = await repository.findByIdForUpdate("withdrawal-1");

    expect(withdrawal?.id).toBe("withdrawal-1");
    expect(withdrawal?.accountId).toBe("account-1");
    expect(withdrawal?.processingAttempts).toBe(1);
    const query = normalizeQuery(prisma.$queryRaw.mock.calls[0][0]);
    expect(query).toContain("FOR UPDATE");
  });

  it("claims processable withdrawals atomically", async () => {
    const now = new Date("2026-05-18T12:00:00.000Z");
    const staleProcessingBefore = new Date("2026-05-18T11:55:00.000Z");
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: "withdrawal-1",
          accountId: "account-1",
          bankAccountId: "bank-1",
          amount: 10_000,
          fee: 199,
          netAmount: 9_801,
          status: "PROCESSING",
          pixE2eId: null,
          paidAt: null,
          failedReason: null,
          processingAttempts: 2,
          nextProcessAt: null,
          lastProcessingError: null,
          createdAt: new Date("2026-05-18T11:00:00.000Z"),
          updatedAt: now,
        },
      ]),
    };
    const repository = new WithdrawalRepository(prisma as any);

    const withdrawals = await repository.claimProcessableWithdrawals({
      limit: 25,
      now,
      staleProcessingBefore,
    });

    expect(withdrawals).toHaveLength(1);
    expect(withdrawals[0].status).toBe("PROCESSING");
    expect(withdrawals[0].processingAttempts).toBe(2);
    expect(withdrawals[0].nextProcessAt).toBeUndefined();
    expect(withdrawals[0].lastProcessingError).toBeUndefined();

    const query = normalizeQuery(prisma.$queryRaw.mock.calls[0][0]);
    expect(query).toContain("FOR UPDATE SKIP LOCKED");
    expect(query).toContain("UPDATE withdrawals AS w");
    expect(query).toContain("processing_attempts = w.processing_attempts + 1");
    expect(query).toContain("next_process_at = NULL");
    expect(query).toContain("last_processing_error = NULL");
    expect(query).toContain("RETURNING");
  });

  it("does not claim withdrawals when limit is zero or negative", async () => {
    const prisma = {
      $queryRaw: vi.fn(),
    };
    const repository = new WithdrawalRepository(prisma as any);

    await expect(
      repository.claimProcessableWithdrawals({ limit: 0 }),
    ).resolves.toEqual([]);
    await expect(
      repository.claimProcessableWithdrawals({ limit: -1 }),
    ).resolves.toEqual([]);

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("includes stale processing withdrawals for crash recovery", async () => {
    const now = new Date("2026-05-18T12:00:00.000Z");
    const prisma = {
      withdrawal: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const repository = new WithdrawalRepository(prisma as any);

    await repository.findProcessablePending(25, now);

    expect(prisma.withdrawal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            {
              status: "PENDING",
              OR: [{ nextProcessAt: null }, { nextProcessAt: { lte: now } }],
            },
            {
              status: "PROCESSING",
              updatedAt: { lte: new Date("2026-05-18T11:55:00.000Z") },
            },
          ],
        },
        take: 25,
      }),
    );
  });
});

function normalizeQuery(query: any): string {
  if (typeof query === "string") {
    return query;
  }

  return [
    query?.sql,
    query?.text,
    Array.isArray(query?.strings) ? query.strings.join("?") : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}
