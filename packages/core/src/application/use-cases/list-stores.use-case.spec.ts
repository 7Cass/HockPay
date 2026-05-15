import { describe, expect, it, vi } from "vitest";
import { Store } from "../../domain/entities/store.entity";
import { ListStoresUseCase } from "./list-stores.use-case";

describe("ListStoresUseCase", () => {
  it("includes commercial and timestamp fields needed by store settings", async () => {
    const createdAt = new Date("2026-05-01T10:00:00.000Z");
    const updatedAt = new Date("2026-05-10T12:00:00.000Z");
    const store = Store.reconstitute({
      id: "store-1",
      merchantId: "merchant-1",
      name: "Smoke Store",
      slug: "smoke-store",
      isActive: true,
      isApproved: true,
      settlementDays: 14,
      feePercent: 1.75,
      feeFixed: 25,
      createdAt,
      updatedAt,
    });
    const repository = {
      findByMerchantId: vi.fn().mockResolvedValue([store]),
    };
    const useCase = new ListStoresUseCase(repository as any);

    const result = await useCase.execute({ merchantId: "merchant-1" });

    expect(repository.findByMerchantId).toHaveBeenCalledWith("merchant-1");
    expect(result.stores).toEqual([
      {
        id: "store-1",
        name: "Smoke Store",
        slug: "smoke-store",
        isActive: true,
        isApproved: true,
        settlementDays: 14,
        feePercent: 1.75,
        feeFixed: 25,
        createdAt,
        updatedAt,
      },
    ]);
  });
});
