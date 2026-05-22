import { describe, expect, it, vi } from "vitest";
import {
  IdempotencyKeyStatus,
  IdempotencyReservationStatus,
} from "@hockpay/core";
import { IdempotencyKeyRepository } from "./idempotency-key.repository";

describe("IdempotencyKeyRepository", () => {
  const now = new Date("2026-05-20T12:00:00.000Z");
  const future = new Date("2030-05-21T12:00:00.000Z");

  const input = {
    key: "idem-1",
    storeId: "store-1",
    requestMethod: "POST",
    requestPath: "/api/v1/payments",
    requestHash: "hash-1",
  };

  function makeRecord(overrides: Record<string, unknown> = {}) {
    return {
      id: "db-idem-1",
      key: "idem-1",
      storeId: "store-1",
      requestMethod: "POST",
      requestPath: "/api/v1/payments",
      requestHash: "hash-1",
      responseBody: { payment: { id: "pay-1" } },
      responseStatus: 201,
      status: IdempotencyKeyStatus.COMPLETED,
      completedAt: now,
      createdAt: now,
      expiresAt: future,
      ...overrides,
    };
  }

  function makePrisma(findUniqueResult: unknown, createManyCount?: number) {
    return {
      idempotencyKey: {
        findUnique: vi.fn().mockResolvedValue(findUniqueResult),
        create: vi.fn(async ({ data }) => ({
          ...data,
          responseBody: data.responseBody ?? null,
          responseStatus: data.responseStatus ?? null,
          completedAt: data.completedAt ?? null,
        })),
        createMany: vi.fn().mockResolvedValue({
          count: createManyCount ?? (findUniqueResult ? 0 : 1),
        }),
        update: vi.fn(async ({ data }) =>
          makeRecord({
            ...data,
            status: data.status,
            completedAt: data.completedAt,
            responseBody: data.responseBody,
            responseStatus: data.responseStatus,
          }),
        ),
        delete: vi.fn().mockResolvedValue(undefined),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
  }

  it("creates a pending reservation when the key does not exist", async () => {
    const prisma = makePrisma(null);
    const repository = new IdempotencyKeyRepository(prisma as any);

    const result = await repository.reserve(input);

    expect(result.status).toBe(IdempotencyReservationStatus.RESERVED);
    expect(prisma.idempotencyKey.createMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        key: "idem-1",
        storeId: "store-1",
        requestMethod: "POST",
        requestPath: "/api/v1/payments",
        requestHash: "hash-1",
        status: IdempotencyKeyStatus.PENDING,
      }),
      skipDuplicates: true,
    });
    expect(prisma.idempotencyKey.createMany.mock.calls[0][0].data).not.toHaveProperty(
      "responseBody",
    );
    expect(prisma.idempotencyKey.createMany.mock.calls[0][0].data).not.toHaveProperty(
      "responseStatus",
    );
    expect(prisma.idempotencyKey.createMany.mock.calls[0][0].data).not.toHaveProperty(
      "completedAt",
    );
    expect(result.key.isCompleted()).toBe(false);
  });

  it("replays a completed matching key", async () => {
    const prisma = makePrisma(makeRecord());
    const repository = new IdempotencyKeyRepository(prisma as any);

    const result = await repository.reserve(input);

    expect(result.status).toBe(IdempotencyReservationStatus.REPLAY);
    expect(prisma.idempotencyKey.create).not.toHaveBeenCalled();
    expect(result.key.responseBody).toEqual({ payment: { id: "pay-1" } });
  });

  it("finds only completed non-expired keys for replay", async () => {
    const prisma = makePrisma(makeRecord());
    const repository = new IdempotencyKeyRepository(prisma as any);

    const completed = await repository.findCompleted("idem-1", "store-1");

    expect(completed?.id).toBe("db-idem-1");
    expect(completed?.responseStatus).toBe(201);

    prisma.idempotencyKey.findUnique.mockResolvedValueOnce(
      makeRecord({
        status: IdempotencyKeyStatus.PENDING,
        responseBody: null,
        responseStatus: null,
        completedAt: null,
      }),
    );

    await expect(repository.findCompleted("idem-1", "store-1")).resolves.toBe(
      null,
    );
  });

  it("returns conflict when the same key was used with a different request", async () => {
    const prisma = makePrisma(makeRecord({ requestHash: "hash-2" }));
    const repository = new IdempotencyKeyRepository(prisma as any);

    const result = await repository.reserve(input);

    expect(result.status).toBe(IdempotencyReservationStatus.CONFLICT);
    expect(prisma.idempotencyKey.create).not.toHaveBeenCalled();
  });

  it("cleans an expired key before creating a new reservation", async () => {
    const prisma = makePrisma(null);
    const repository = new IdempotencyKeyRepository(prisma as any);

    const result = await repository.reserve(input);

    expect(prisma.idempotencyKey.deleteMany).toHaveBeenCalledWith({
      where: {
        key: "idem-1",
        storeId: "store-1",
        expiresAt: {
          lt: expect.any(Date),
        },
      },
    });
    expect(prisma.idempotencyKey.createMany).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(IdempotencyReservationStatus.RESERVED);
  });

  it("marks a reservation as completed with the response payload", async () => {
    const prisma = makePrisma(null);
    const repository = new IdempotencyKeyRepository(prisma as any);

    const result = await repository.complete(
      "db-idem-1",
      { payment: { id: "pay-1" } },
      201,
    );

    expect(prisma.idempotencyKey.update).toHaveBeenCalledWith({
      where: { id: "db-idem-1" },
      data: expect.objectContaining({
        status: IdempotencyKeyStatus.COMPLETED,
        responseBody: { payment: { id: "pay-1" } },
        responseStatus: 201,
        completedAt: expect.any(Date),
      }),
    });
    expect(result.isCompleted()).toBe(true);
  });
});
