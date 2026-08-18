import { describe, expect, it } from "vitest";
import { Account } from "./account.entity";
import { InvalidBalanceError } from "../errors/invalid-balance.error";
import { DomainError } from "../errors/domain-error";

describe("Account", () => {
  it("throws InvalidBalanceError when deducting more than available", () => {
    const account = Account.create({ storeId: "store-1" });
    account.addToPending(1000);
    account.releaseFromPending(1000);

    expect(() => account.deductFromAvailable(1001)).toThrow(InvalidBalanceError);
    try {
      account.deductFromAvailable(1001);
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as InvalidBalanceError).code).toBe("INVALID_BALANCE");
    }
  });

  it("throws InvalidBalanceError for a negative amount", () => {
    const account = Account.create({ storeId: "store-1" });
    expect(() => account.addToPending(-1)).toThrow(InvalidBalanceError);
  });
});
