import { describe, expect, it, vi } from "vitest";
import { WithdrawalRepository } from "./withdrawal.repository";

describe("WithdrawalRepository", () => {
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
