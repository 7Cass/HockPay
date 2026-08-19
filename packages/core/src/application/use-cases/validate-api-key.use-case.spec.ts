import { describe, expect, it, vi } from "vitest";
import { InvalidApiKeyFormatError } from "../../domain/errors/invalid-api-key-format.error";
import { ValidateApiKeyUseCase } from "./validate-api-key.use-case";

describe("ValidateApiKeyUseCase", () => {
  it("rejects malformed keys without echoing the secret", async () => {
    const useCase = new ValidateApiKeyUseCase(
      { findByKeyHash: vi.fn() } as never,
      { hash: vi.fn() } as never,
    );

    await expect(
      useCase.execute({ plainKey: "not-a-key-secret" }),
    ).rejects.toBeInstanceOf(InvalidApiKeyFormatError);

    try {
      await useCase.execute({ plainKey: "not-a-key-secret" });
    } catch (error) {
      expect((error as Error).message).toBe("Invalid API Key format");
      expect((error as Error).message).not.toContain("not-a-key-secret");
    }
  });
});
