import { describe, expect, it, vi } from "vitest";
import { WebhookLogRepository } from "./webhook-log.repository";

describe("WebhookLogRepository", () => {
  function makeRepository() {
    const prisma = {
      webhookLog: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
    };

    return {
      prisma,
      repository: new WebhookLogRepository(prisma as any),
    };
  }

  it("paginates config logs in the database", async () => {
    const { prisma, repository } = makeRepository();

    await repository.findByConfigId("config-1", {
      page: 2,
      limit: 25,
    });

    expect(prisma.webhookLog.findMany).toHaveBeenCalledWith({
      where: { configId: "config-1" },
      orderBy: { createdAt: "desc" },
      skip: 25,
      take: 25,
    });
  });

  it.each([
    ["delivered", { configId: "config-1", deliveredAt: { not: null } }],
    ["failed", { configId: "config-1", deliveredAt: null, attempt: { gt: 1 } }],
    ["pending", { configId: "config-1", deliveredAt: null, attempt: 1 }],
  ] as const)("applies the %s status filter to find and count", async (status, where) => {
    const { prisma, repository } = makeRepository();

    await repository.findByConfigId("config-1", {
      page: 1,
      limit: 10,
      status,
    });
    await repository.countByConfigId("config-1", status);

    expect(prisma.webhookLog.findMany).toHaveBeenCalledWith({
      where,
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 10,
    });
    expect(prisma.webhookLog.count).toHaveBeenCalledWith({ where });
  });
});
