import { describe, expect, it, vi } from "vitest";
import { ConfirmPaymentUseCase } from "./confirm-payment.use-case";
import { Payment } from "../../domain/entities/payment.entity";
import { PixCharge } from "../../domain/entities/pix-charge.entity";
import { Environment } from "../../domain/value-objects/environment.vo";
import { Customer } from "../../domain/entities/customer.entity";
import { Document } from "../../domain/value-objects/document.vo";

describe("ConfirmPaymentUseCase", () => {
  const account = {
    id: "account-1",
    totalBalance: 7855,
    addToPending: vi.fn(),
  };

  const store = {
    id: "store-1",
    name: "Hockpay Store",
  };

  it("builds the receipt from the payment payer snapshot", async () => {
    const payment = Payment.create({
      storeId: "store-1",
      amount: 7990,
      fee: 135,
      netAmount: 7855,
      payerName: "Visitante",
      payerEmail: "guest@example.com",
      expiresAt: new Date(Date.now() + 60_000),
      environment: Environment.TEST,
    });

    let savedReceipt: any;

    const unitOfWork = {
      execute: async (work: any) =>
        work({
          paymentRepository: {
            findByIdAndStoreIdForUpdate: vi.fn().mockResolvedValue(payment),
            update: vi.fn(),
          },
          accountRepository: {
            findByStoreIdForUpdate: vi.fn().mockResolvedValue(account),
            update: vi.fn(),
          },
          transactionRepository: {
            save: vi.fn(),
          },
          bankAccountRepository: {},
          outboxWriter: {
            save: vi.fn(),
          },
          receiptRepository: {
            incrementCounter: vi.fn().mockResolvedValue(1),
            save: vi.fn(async (receipt: any) => {
              savedReceipt = receipt;
            }),
          },
          storeRepository: {
            findById: vi.fn().mockResolvedValue(store),
          },
          customerRepository: {},
        }),
    };

    const useCase = new ConfirmPaymentUseCase(unitOfWork as any);

    await useCase.execute({
      storeId: "store-1",
      paymentId: payment.id,
    });

    expect(savedReceipt.payerName).toBe("Visitante");
    expect(savedReceipt.payerEmail).toBe("guest@example.com");
  });

  it("locks payment, Pix charge and account before confirming a Pix payment", async () => {
    const pixCharge = PixCharge.create({
      storeId: "store-1",
      amount: 7990,
      pixQrCode: "qr-code",
      pixCopyPaste: "copy-paste",
      pixTxId: "tx-1",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const payment = Payment.create({
      storeId: "store-1",
      pixChargeId: pixCharge.id,
      amount: 7990,
      fee: 135,
      netAmount: 7855,
      expiresAt: new Date(Date.now() + 60_000),
      environment: Environment.TEST,
    });
    const paymentRepository = {
      findByIdAndStoreIdForUpdate: vi.fn().mockResolvedValue(payment),
      findByPixChargeIdAndStoreId: vi.fn().mockResolvedValue([payment]),
      update: vi.fn(),
    };
    const pixChargeRepository = {
      findByIdAndStoreIdForUpdate: vi.fn().mockResolvedValue(pixCharge),
      update: vi.fn(),
    };
    const accountRepository = {
      findByStoreIdForUpdate: vi.fn().mockResolvedValue(account),
      update: vi.fn(),
    };
    const unitOfWork = {
      execute: async (work: any) =>
        work({
          paymentRepository,
          pixChargeRepository,
          accountRepository,
          transactionRepository: {
            save: vi.fn(),
          },
          bankAccountRepository: {},
          outboxWriter: {
            save: vi.fn(),
          },
          receiptRepository: {
            incrementCounter: vi.fn().mockResolvedValue(1),
            save: vi.fn(),
          },
          storeRepository: {
            findById: vi.fn().mockResolvedValue(store),
          },
          customerRepository: {},
        }),
    };

    await new ConfirmPaymentUseCase(unitOfWork as any).execute({
      storeId: "store-1",
      paymentId: payment.id,
    });

    expect(paymentRepository.findByIdAndStoreIdForUpdate).toHaveBeenCalledWith(
      payment.id,
      "store-1",
    );
    expect(
      pixChargeRepository.findByIdAndStoreIdForUpdate,
    ).toHaveBeenCalledWith(pixCharge.id, "store-1");
    expect(accountRepository.findByStoreIdForUpdate).toHaveBeenCalledWith(
      "store-1",
    );
    expect(pixChargeRepository.update).toHaveBeenCalledWith(pixCharge);
  });

  it("falls back to the associated customer when the payment has no payer snapshot", async () => {
    const customer = Customer.create({
      storeId: "store-1",
      name: "Cliente Legado",
      email: "legacy@example.com",
      document: new Document("52998224725"),
    });

    const payment = Payment.create({
      storeId: "store-1",
      customerId: customer.id,
      amount: 7990,
      fee: 135,
      netAmount: 7855,
      expiresAt: new Date(Date.now() + 60_000),
      environment: Environment.TEST,
    });

    let savedReceipt: any;
    const customerRepository = {
      findById: vi.fn().mockResolvedValue(customer),
    };

    const unitOfWork = {
      execute: async (work: any) =>
        work({
          paymentRepository: {
            findByIdAndStoreIdForUpdate: vi.fn().mockResolvedValue(payment),
            update: vi.fn(),
          },
          accountRepository: {
            findByStoreIdForUpdate: vi.fn().mockResolvedValue(account),
            update: vi.fn(),
          },
          transactionRepository: {
            save: vi.fn(),
          },
          bankAccountRepository: {},
          outboxWriter: {
            save: vi.fn(),
          },
          receiptRepository: {
            incrementCounter: vi.fn().mockResolvedValue(1),
            save: vi.fn(async (receipt: any) => {
              savedReceipt = receipt;
            }),
          },
          storeRepository: {
            findById: vi.fn().mockResolvedValue(store),
          },
          customerRepository,
        }),
    };

    const useCase = new ConfirmPaymentUseCase(unitOfWork as any);

    await useCase.execute({
      storeId: "store-1",
      paymentId: payment.id,
    });

    expect(savedReceipt.payerName).toBe("Cliente Legado");
    expect(savedReceipt.payerDocument).toBe("52998224725");
    expect(savedReceipt.payerEmail).toBe("legacy@example.com");
    expect(customerRepository.findById).toHaveBeenCalledWith(customer.id);
  });
});
