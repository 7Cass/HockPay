import { describe, expect, it, vi } from "vitest";
import { Store } from "../../domain/entities/store.entity";
import { UpdateStoreProfileUseCase } from "./update-store-profile.use-case";

describe("UpdateStoreProfileUseCase", () => {
  it("updates name and city and ignores a missing fee field", async () => {
    const store = Store.reconstitute({
      id: "store-1",
      merchantId: "merchant-1",
      name: "Old",
      slug: "old",
      isActive: true,
      isApproved: true,
      settlementDays: 30,
      feePercent: 1.5,
      feeFixed: 15,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const repository = {
      findByIdAndMerchantId: vi.fn().mockResolvedValue(store),
      update: vi.fn(),
    };

    const result = await new UpdateStoreProfileUseCase(repository as never).execute({
      storeId: "store-1",
      merchantId: "merchant-1",
      name: "Nova Loja",
      city: "Curitiba",
    });

    expect(result.store.name).toBe("Nova Loja");
    expect(result.store.city).toBe("Curitiba");
    expect(result.store.feePercent).toBe(1.5);
    expect(repository.update).toHaveBeenCalledWith(store);
  });
});
