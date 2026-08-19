import { describe, expect, it, vi } from "vitest";
import { BankAccountHolderMismatchError } from "../../domain/errors/bank-account-holder-mismatch.error";
import { PixKeyType } from "../../domain/entities/bank-account.entity";
import { CreateBankAccountUseCase } from "./create-bank-account.use-case";

describe("CreateBankAccountUseCase", () => {
  it("resolves titularidade from the store merchant, not the request user", async () => {
    const store = { merchantId: "merchant-1" };
    const merchant = { document: { value: "52998224725" } };
    const repos = {
      storeRepository: { findById: vi.fn().mockResolvedValue(store) },
      merchantRepository: { findById: vi.fn().mockResolvedValue(merchant) },
      bankAccountRepository: {
        save: vi.fn(),
        clearDefaultFlagExcept: vi.fn(),
      },
    };
    const useCase = new CreateBankAccountUseCase({
      execute: (handler: (r: typeof repos) => Promise<unknown>) =>
        handler(repos),
    } as never);

    const account = await useCase.execute({
      storeId: "store-1",
      pixKey: "52998224725",
      pixKeyType: PixKeyType.CPF,
      holderName: "Ana",
      holderDocument: "529.982.247-25",
    });

    expect(repos.storeRepository.findById).toHaveBeenCalledWith("store-1");
    expect(repos.merchantRepository.findById).toHaveBeenCalledWith("merchant-1");
    expect(repos.bankAccountRepository.save).toHaveBeenCalledWith(account);
    expect(account.isVerified).toBe(true);
  });

  it("rejects a holder document that does not match the store merchant", async () => {
    const repos = {
      storeRepository: {
        findById: vi.fn().mockResolvedValue({ merchantId: "merchant-1" }),
      },
      merchantRepository: {
        findById: vi.fn().mockResolvedValue({
          document: { value: "52998224725" },
        }),
      },
      bankAccountRepository: {
        save: vi.fn(),
        clearDefaultFlagExcept: vi.fn(),
      },
    };
    const useCase = new CreateBankAccountUseCase({
      execute: (handler: (r: typeof repos) => Promise<unknown>) =>
        handler(repos),
    } as never);

    await expect(
      useCase.execute({
        storeId: "store-1",
        pixKey: "39053344705",
        pixKeyType: PixKeyType.CPF,
        holderName: "Outro",
        holderDocument: "39053344705",
      }),
    ).rejects.toBeInstanceOf(BankAccountHolderMismatchError);

    expect(repos.bankAccountRepository.save).not.toHaveBeenCalled();
  });
});
