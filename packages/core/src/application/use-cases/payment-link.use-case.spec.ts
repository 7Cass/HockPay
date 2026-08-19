import { describe, expect, it, vi } from 'vitest';
import { PixCharge, PixChargeStatus } from '../../domain/entities/pix-charge.entity';
import { Payment, PaymentMethod } from '../../domain/entities/payment.entity';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';
import { Environment } from '../../domain/value-objects/environment.vo';
import { InvalidLineItemsError } from '../../domain/errors/invalid-line-items.error';
import { LiveEnvironmentNotAllowedError } from '../../domain/errors/live-environment-not-allowed.error';
import { CancelPaymentLinkUseCase } from './cancel-payment-link.use-case';
import {
  CreatePaymentLinkUseCase,
  PaymentLinkInvalidExpirationError,
} from './create-payment-link.use-case';
import { FailPaymentLinkUseCase } from './fail-payment-link.use-case';
import { GetPaymentLinkUseCase } from './get-payment-link.use-case';
import { ListPaymentLinksUseCase } from './list-payment-links.use-case';
import { OpenPaymentLinkUseCase } from './open-payment-link.use-case';
import { PayPaymentLinkUseCase } from './pay-payment-link.use-case';

describe('PaymentLink use cases', () => {
  it('creates an avulso payment link backed by an open Pix charge without creating a payment', async () => {
    const paymentLinkRepository = {
      save: vi.fn(),
    };
    const pixChargeRepository = {
      save: vi.fn(),
    };
    const storeRepository = {
      findById: vi.fn().mockResolvedValue({
        id: 'store-1',
        name: 'Hockpay Store',
        isActive: true,
        isApproved: true,
      }),
    };
    const tokenGenerator = {
      generateBase64: vi.fn().mockReturnValue('public-token'),
    };
    const pixQrCodeGenerator = {
      generate: vi.fn().mockResolvedValue({
        qrCodeBase64: 'qr-code',
        copyPaste: 'pix-copy-paste',
        txId: 'pix-tx-id',
      }),
    };

    const useCase = new CreatePaymentLinkUseCase(
      paymentLinkRepository as any,
      pixChargeRepository as any,
      storeRepository as any,
      tokenGenerator as any,
      pixQrCodeGenerator as any,
      'http://localhost:3333',
      'test@hockpay.com',
    );

    const result = await useCase.execute({
      storeId: 'store-1',
      amount: 12990,
      title: 'Compra avulsa',
    });

    expect(result.paymentLink.checkoutUrl).toBe('http://localhost:3333/pay/public-token');
    expect(result.paymentLink.status).toBe('ACTIVE');
    expect(result.paymentLink.expiresAt).toBeNull();
    expect(result.paymentLink.paymentId).toBeNull();
    expect(result.paymentLink.pixCharge.status).toBe(PixChargeStatus.OPEN);
    expect(result.paymentLink.pixCharge.expiresAt).toBeUndefined();
    expect(pixChargeRepository.save).toHaveBeenCalledOnce();
    expect(paymentLinkRepository.save).toHaveBeenCalledOnce();
    expect(pixChargeRepository.save.mock.calls[0][0].expiresAt).toBeUndefined();
    expect(paymentLinkRepository.save.mock.calls[0][0].expiresAt).toBeNull();
  });

  it('persists PixCharge and PaymentLink through UnitOfWork when configured', async () => {
    const directPaymentLinkRepository = {
      save: vi.fn(),
    };
    const directPixChargeRepository = {
      save: vi.fn(),
    };
    const transactionalPaymentLinkRepository = {
      save: vi.fn(),
    };
    const transactionalPixChargeRepository = {
      save: vi.fn(),
    };
    const unitOfWork = {
      execute: vi.fn((handler) =>
        handler({
          paymentLinkRepository: transactionalPaymentLinkRepository,
          pixChargeRepository: transactionalPixChargeRepository,
          storeRepository: {
            findById: vi.fn().mockResolvedValue({
              id: 'store-1',
              name: 'Hockpay Store',
              isActive: true,
              isApproved: true,
            }),
          },
        }),
      ),
    };
    const useCase = new CreatePaymentLinkUseCase(
      directPaymentLinkRepository as any,
      directPixChargeRepository as any,
      {
        findById: vi.fn().mockResolvedValue({
          id: 'store-1',
          name: 'Hockpay Store',
          isActive: true,
          isApproved: true,
        }),
      } as any,
      { generateBase64: vi.fn().mockReturnValue('public-token') } as any,
      {
        generate: vi.fn().mockResolvedValue({
          qrCodeBase64: 'qr-code',
          copyPaste: 'pix-copy-paste',
          txId: 'pix-tx-id',
        }),
      } as any,
      'http://localhost:3333',
      'test@hockpay.com',
      unitOfWork as any,
    );

    await useCase.execute({
      storeId: 'store-1',
      amount: 12990,
    });

    expect(unitOfWork.execute).toHaveBeenCalledTimes(1);
    expect(transactionalPixChargeRepository.save).toHaveBeenCalledOnce();
    expect(transactionalPaymentLinkRepository.save).toHaveBeenCalledOnce();
    expect(directPixChargeRepository.save).not.toHaveBeenCalled();
    expect(directPaymentLinkRepository.save).not.toHaveBeenCalled();
  });

  it('rejects items in payment link creation', async () => {
    const pixQrCodeGenerator = {
      generate: vi.fn(),
    };
    const useCase = new CreatePaymentLinkUseCase(
      { save: vi.fn() } as any,
      { save: vi.fn() } as any,
      {
        findById: vi.fn().mockResolvedValue({
          id: 'store-1',
          name: 'Hockpay Store',
          isActive: true,
          isApproved: true,
        }),
      } as any,
      { generateBase64: vi.fn().mockReturnValue('public-token') } as any,
      pixQrCodeGenerator as any,
      'http://localhost:3333',
      'test@hockpay.com',
    );

    await expect(
      useCase.execute({
        storeId: 'store-1',
        amount: 12990,
        items: [{ productId: 'prod-1' }],
      }),
    ).rejects.toBeInstanceOf(InvalidLineItemsError);
    expect(pixQrCodeGenerator.generate).not.toHaveBeenCalled();
  });

  it('applies a future expiration to both the payment link and Pix charge', async () => {
    const paymentLinkRepository = {
      save: vi.fn(),
    };
    const pixChargeRepository = {
      save: vi.fn(),
    };
    const storeRepository = {
      findById: vi.fn().mockResolvedValue({
        id: 'store-1',
        name: 'Hockpay Store',
        isActive: true,
        isApproved: true,
      }),
    };
    const tokenGenerator = {
      generateBase64: vi.fn().mockReturnValue('public-token'),
    };
    const pixQrCodeGenerator = {
      generate: vi.fn().mockResolvedValue({
        qrCodeBase64: 'qr-code',
        copyPaste: 'pix-copy-paste',
        txId: 'pix-tx-id',
      }),
    };

    const useCase = new CreatePaymentLinkUseCase(
      paymentLinkRepository as any,
      pixChargeRepository as any,
      storeRepository as any,
      tokenGenerator as any,
      pixQrCodeGenerator as any,
      'http://localhost:3333',
      'test@hockpay.com',
    );
    const expiresAt = new Date(Date.now() + 60_000);

    const result = await useCase.execute({
      storeId: 'store-1',
      amount: 12990,
      expiresAt,
    });

    expect(result.paymentLink.expiresAt).toBe(expiresAt);
    expect(result.paymentLink.pixCharge.expiresAt).toBe(expiresAt);
    expect(pixChargeRepository.save.mock.calls[0][0].expiresAt).toBe(expiresAt);
    expect(paymentLinkRepository.save.mock.calls[0][0].expiresAt).toBe(expiresAt);
  });

  it('rejects payment links with a past expiration', async () => {
    const paymentLinkRepository = {
      save: vi.fn(),
    };
    const pixChargeRepository = {
      save: vi.fn(),
    };
    const storeRepository = {
      findById: vi.fn().mockResolvedValue({
        id: 'store-1',
        name: 'Hockpay Store',
        isActive: true,
        isApproved: true,
      }),
    };
    const tokenGenerator = {
      generateBase64: vi.fn().mockReturnValue('public-token'),
    };
    const pixQrCodeGenerator = {
      generate: vi.fn(),
    };

    const useCase = new CreatePaymentLinkUseCase(
      paymentLinkRepository as any,
      pixChargeRepository as any,
      storeRepository as any,
      tokenGenerator as any,
      pixQrCodeGenerator as any,
      'http://localhost:3333',
      'test@hockpay.com',
    );

    await expect(
      useCase.execute({
        storeId: 'store-1',
        amount: 12990,
        expiresAt: new Date(Date.now() - 60_000),
      }),
    ).rejects.toThrow(PaymentLinkInvalidExpirationError);
    expect(pixQrCodeGenerator.generate).not.toHaveBeenCalled();
    expect(pixChargeRepository.save).not.toHaveBeenCalled();
    expect(paymentLinkRepository.save).not.toHaveBeenCalled();
  });

  it('does not expire an open Pix charge without an expiration date', () => {
    const charge = PixCharge.create({
      storeId: 'store-1',
      amount: 12990,
      pixQrCode: 'qr-code',
      pixCopyPaste: 'pix-copy-paste',
      pixTxId: 'pix-tx-id',
      expiresAt: null,
    });

    expect(charge.hasExpired(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000))).toBe(false);
  });

  it('passes the hasFailures list filter to the repository', async () => {
    const repository = {
      list: vi.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        stats: {
          total: 0,
          active: 0,
          opened: 0,
          pending: 0,
          paid: 0,
          expired: 0,
          cancelled: 0,
          conversionRate: 0,
          paidAmount: 0,
        },
      }),
    };
    const useCase = new ListPaymentLinksUseCase(repository as any);

    await useCase.execute({
      storeId: 'store-1',
      environment: Environment.TEST,
      page: 1,
      limit: 20,
      hasFailures: true,
    });

    expect(repository.list).toHaveBeenCalledWith({
      storeId: 'store-1',
      environment: Environment.TEST,
      page: 1,
      limit: 20,
      hasFailures: true,
    });
  });

  it('opens a payment link without creating a payment or mutating the link', async () => {
    const paymentLinkRepository = {
      findPublicByToken: vi.fn().mockResolvedValue({
        id: 'link-1',
        storeId: 'store-1',
        pixChargeId: 'charge-1',
        publicToken: 'public-token',
        amount: 5000,
        currency: 'BRL',
        environment: Environment.TEST,
        title: 'Venda avulsa',
        description: null,
        internalReference: null,
        expiresAt: null,
        openedAt: null,
        cancelledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        checkoutUrl: 'http://localhost:3333/pay/public-token',
        status: 'ACTIVE',
        paymentId: null,
        paymentStatus: null,
        pixCharge: {
          id: 'charge-1',
          storeId: 'store-1',
          amount: 5000,
          currency: 'BRL',
          status: PixChargeStatus.OPEN,
          pixQrCode: 'qr-code',
          pixCopyPaste: 'pix-copy-paste',
          pixTxId: 'pix-tx-id',
          expiresAt: new Date(Date.now() + 60_000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        failedPaymentCount: 0,
        lastPaymentId: null,
        lastPaymentStatus: null,
        lastPayment: null,
        lastFailedAt: null,
      }),
      update: vi.fn(),
    };

    const useCase = new OpenPaymentLinkUseCase(paymentLinkRepository as any);

    const result = await useCase.execute({
      publicToken: 'public-token',
    });

    expect(paymentLinkRepository.update).not.toHaveBeenCalled();
    expect(result.paymentLink.id).toBe('link-1');
    expect(result.pixCharge.pixTxId).toBe('pix-tx-id');
    expect(result.lastPayment).toBeNull();
    expect(result.actions.canPay).toBe(true);
  });

  it('returns the last failed payment while keeping the link payable', async () => {
    const paymentLinkRepository = {
      findPublicByToken: vi.fn().mockResolvedValue({
        id: 'link-1',
        storeId: 'store-1',
        pixChargeId: 'charge-1',
        publicToken: 'public-token',
        amount: 5000,
        currency: 'BRL',
        environment: Environment.TEST,
        title: null,
        description: null,
        internalReference: null,
        expiresAt: null,
        openedAt: null,
        cancelledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        checkoutUrl: 'http://localhost:3333/pay/public-token',
        status: 'ACTIVE',
        paymentId: 'payment-1',
        paymentStatus: PaymentStatus.FAILED,
        pixCharge: {
          id: 'charge-1',
          storeId: 'store-1',
          amount: 5000,
          currency: 'BRL',
          status: PixChargeStatus.OPEN,
          pixQrCode: 'qr-code',
          pixCopyPaste: 'pix-copy-paste',
          pixTxId: 'pix-tx-id',
          expiresAt: new Date(Date.now() + 60_000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        failedPaymentCount: 1,
        lastPaymentId: 'payment-1',
        lastPaymentStatus: PaymentStatus.FAILED,
        lastPayment: {
          id: 'payment-1',
          storeId: 'store-1',
          amount: 5000,
          fee: 90,
          netAmount: 4910,
          currency: 'BRL',
          status: PaymentStatus.FAILED,
          environment: 'TEST',
          paymentMethod: 'PIX',
          totalRefunded: 0,
          expiresAt: new Date(Date.now() + 60_000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        lastFailedAt: new Date(),
      }),
    };

    const useCase = new OpenPaymentLinkUseCase(paymentLinkRepository as any);
    const result = await useCase.execute({ publicToken: 'public-token' });

    expect(result.lastPayment?.status).toBe(PaymentStatus.FAILED);
    expect(result.actions.canPay).toBe(true);
  });

  it('returns payment link detail attempts from the repository', async () => {
    const attempts = [
      { id: 'payment-1', attemptNumber: 1, attemptCount: 2 },
      { id: 'payment-2', attemptNumber: 2, attemptCount: 2 },
    ];
    const repository = {
      findListItemByIdAndStoreId: vi.fn().mockResolvedValue({
        id: 'link-1',
        storeId: 'store-1',
        environment: Environment.TEST,
        attempts,
      }),
    };
    const useCase = new GetPaymentLinkUseCase(repository as any);

    const result = await useCase.execute({
      storeId: 'store-1',
      paymentLinkId: 'link-1',
      environment: Environment.TEST,
    });

    expect(repository.findListItemByIdAndStoreId).toHaveBeenCalledWith('link-1', 'store-1');
    expect(result.paymentLink.attempts).toEqual(attempts);
  });

  it('does not return a LIVE payment link to a TEST caller', async () => {
    const repository = {
      findListItemByIdAndStoreId: vi.fn().mockResolvedValue({
        id: 'link-1',
        storeId: 'store-1',
        environment: Environment.LIVE,
      }),
    };
    const useCase = new GetPaymentLinkUseCase(repository as never);

    await expect(
      useCase.execute({
        storeId: 'store-1',
        paymentLinkId: 'link-1',
        environment: Environment.TEST,
      }),
    ).rejects.toMatchObject({ code: 'PAYMENT_LINK_NOT_FOUND' });
  });

  it('cancels PaymentLink and PixCharge through locked transactional repositories', async () => {
    const { useCase, link, charge, paymentLinkRepository, pixChargeRepository } =
      makeCancelPaymentLinkSut({
        linkEnvironment: Environment.TEST,
      });

    await useCase.execute({
      storeId: 'store-1',
      paymentLinkId: 'link-1',
      environment: Environment.TEST,
    });

    expect(paymentLinkRepository.findByIdAndStoreIdForUpdate).toHaveBeenCalledWith(
      'link-1',
      'store-1',
    );
    expect(pixChargeRepository.findByIdAndStoreIdForUpdate).toHaveBeenCalledWith(
      'charge-1',
      'store-1',
    );
    expect(link.cancel).toHaveBeenCalledOnce();
    expect(paymentLinkRepository.update).toHaveBeenCalledWith(link);
    expect(pixChargeRepository.update).toHaveBeenCalledWith(charge);
    expect(charge.status).toBe(PixChargeStatus.CANCELLED);
  });

  it('refuses a TEST caller cancelling a LIVE payment link without touching the charge', async () => {
    const { useCase, link, charge, paymentLinkRepository, pixChargeRepository } =
      makeCancelPaymentLinkSut({
        linkEnvironment: Environment.LIVE,
      });

    await expect(
      useCase.execute({
        storeId: 'store-1',
        paymentLinkId: 'link-1',
        environment: Environment.TEST,
      }),
    ).rejects.toBeInstanceOf(LiveEnvironmentNotAllowedError);

    expect(link.cancel).not.toHaveBeenCalled();
    expect(paymentLinkRepository.update).not.toHaveBeenCalled();
    expect(pixChargeRepository.findByIdAndStoreIdForUpdate).not.toHaveBeenCalled();
    expect(pixChargeRepository.update).not.toHaveBeenCalled();
    expect(charge.status).toBe(PixChargeStatus.OPEN);
  });

  it('allows a LIVE caller to cancel a LIVE payment link', async () => {
    const { useCase, link, paymentLinkRepository } = makeCancelPaymentLinkSut({
      linkEnvironment: Environment.LIVE,
    });

    await useCase.execute({
      storeId: 'store-1',
      paymentLinkId: 'link-1',
      environment: Environment.LIVE,
    });

    expect(link.cancel).toHaveBeenCalledOnce();
    expect(paymentLinkRepository.update).toHaveBeenCalledWith(link);
  });

  it('creates a failed payment link attempt and keeps the PixCharge open', async () => {
    const item = makePaymentLinkListItem();
    let savedPayment: Payment | null = null;
    const outboxWriter = { save: vi.fn() };
    const paymentRepository = {
      save: vi.fn(async (payment: Payment) => {
        savedPayment = payment;
      }),
      findByPixChargeIdAndStoreId: vi.fn(async () => [savedPayment]),
    };
    const unitOfWork = {
      execute: vi.fn((handler) =>
        handler({
          paymentLinkRepository: { findPublicByTokenForUpdate: vi.fn().mockResolvedValue(item) },
          pixChargeRepository: {
            findByIdAndStoreIdForUpdate: vi.fn().mockResolvedValue(makePixChargeFromItem(item)),
            update: vi.fn(),
          },
          storeRepository: { findById: vi.fn().mockResolvedValue(makeStore()) },
          paymentRepository,
          outboxWriter,
        }),
      ),
    };
    const useCase = new FailPaymentLinkUseCase(
      { findPublicByToken: vi.fn().mockResolvedValue(item) } as any,
      unitOfWork as any,
      { calculate: vi.fn().mockReturnValue({ feeInCents: 90, netAmountInCents: 4910 }) } as any,
    );

    const result = await useCase.execute({
      publicToken: 'public-token',
      environment: Environment.TEST,
      reason: 'card_declined',
    });

    expect(result.payment.status).toBe(PaymentStatus.FAILED);
    expect(result.payment.failedReason).toBe('card_declined');
    expect(result.payment.attemptNumber).toBe(1);
    expect(result.payment.pixCharge?.status).toBe(PixChargeStatus.OPEN);
    expect(outboxWriter.save.mock.calls[0][0].eventType).toBe('payment.failed');
  });

  it('numbers multiple failed attempts before a payment link is paid', async () => {
    const item = makePaymentLinkListItem();
    const previousPayment = Payment.reconstitute({
      id: 'payment-1',
      storeId: 'store-1',
      pixChargeId: 'charge-1',
      amount: 5000,
      fee: 90,
      netAmount: 4910,
      currency: 'BRL',
      status: PaymentStatus.FAILED,
      environment: Environment.TEST,
      paymentMethod: PaymentMethod.PIX,
      totalRefunded: 0,
      pixCharge: item.pixCharge,
      expiresAt: new Date(Date.now() + 60_000),
      failedReason: 'first failure',
      metadata: {
        origin: 'payment_link',
        paymentLinkId: 'link-1',
      },
      createdAt: new Date('2026-05-15T10:00:00.000Z'),
      updatedAt: new Date('2026-05-15T10:00:00.000Z'),
    });
    let savedPayment: Payment | null = null;
    const paymentRepository = {
      save: vi.fn(async (payment: Payment) => {
        savedPayment = payment;
      }),
      findByPixChargeIdAndStoreId: vi.fn(async () => [previousPayment, savedPayment]),
    };
    const useCase = new FailPaymentLinkUseCase(
      { findPublicByToken: vi.fn().mockResolvedValue(item) } as any,
      {
        execute: vi.fn((handler) =>
          handler({
            paymentLinkRepository: { findPublicByTokenForUpdate: vi.fn().mockResolvedValue(item) },
            pixChargeRepository: {
              findByIdAndStoreIdForUpdate: vi.fn().mockResolvedValue(makePixChargeFromItem(item)),
              update: vi.fn(),
            },
            storeRepository: { findById: vi.fn().mockResolvedValue(makeStore()) },
            paymentRepository,
            outboxWriter: { save: vi.fn() },
          }),
        ),
      } as any,
      { calculate: vi.fn().mockReturnValue({ feeInCents: 90, netAmountInCents: 4910 }) } as any,
    );

    const result = await useCase.execute({
      publicToken: 'public-token',
      environment: Environment.TEST,
    });

    expect(result.payment.attemptNumber).toBe(2);
    expect(result.payment.attemptCount).toBe(2);
    expect(result.payment.isLatestAttempt).toBe(true);
  });

  it('creates and confirms a payment link attempt in one transaction', async () => {
    const item = makePaymentLinkListItem();
    let savedPayment: Payment | null = null;
    const pixCharge = makePixChargeFromItem(item);
    const outboxWriter = { save: vi.fn() };
    const account = {
      id: 'account-1',
      totalBalance: 4910,
      addToPending: vi.fn(),
    };
    const useCase = new PayPaymentLinkUseCase(
      { findPublicByToken: vi.fn().mockResolvedValue(item) } as any,
      {
        execute: vi.fn((handler) =>
          handler({
            paymentLinkRepository: { findPublicByTokenForUpdate: vi.fn().mockResolvedValue(item) },
            pixChargeRepository: {
              findByIdAndStoreIdForUpdate: vi.fn().mockResolvedValue(pixCharge),
              update: vi.fn(),
            },
            storeRepository: { findById: vi.fn().mockResolvedValue(makeStore()) },
            customerRepository: {
              findByDocument: vi.fn().mockResolvedValue(null),
              save: vi.fn(),
              findById: vi.fn().mockResolvedValue({
                name: 'Ana',
                email: undefined,
                document: { value: '52998224725' },
              }),
            },
            paymentRepository: {
              save: vi.fn(async (payment: Payment) => {
                savedPayment = payment;
              }),
              update: vi.fn(),
              findByPixChargeIdAndStoreId: vi.fn(async () => [savedPayment]),
            },
            accountRepository: {
              findByStoreIdForUpdate: vi.fn().mockResolvedValue(account),
              update: vi.fn(),
            },
            transactionRepository: { save: vi.fn() },
            receiptRepository: {
              incrementCounter: vi.fn().mockResolvedValue(1),
              save: vi.fn(),
            },
            outboxWriter,
          }),
        ),
      } as any,
      { calculate: vi.fn().mockReturnValue({ feeInCents: 90, netAmountInCents: 4910 }) } as any,
    );

    const result = await useCase.execute({
      publicToken: 'public-token',
      environment: Environment.TEST,
      requestId: 'req-1',
      customer: { document: '52998224725', name: 'Ana' },
    });

    expect(account.addToPending).toHaveBeenCalledWith(4910);
    expect(outboxWriter.save.mock.calls.map((call) => call[0].eventType)).toEqual([
      'payment.created',
      'payment.confirmed',
    ]);
    expect(result.payment.status).toBe(PaymentStatus.CONFIRMED);
    expect(result.payment.pixCharge?.status).toBe(PixChargeStatus.PAID);
    expect(result.payment.customerId).toBeDefined();
  });

  it('rejects public pay without a customer document', async () => {
    const item = makePaymentLinkListItem();
    const useCase = new PayPaymentLinkUseCase(
      { findPublicByToken: vi.fn().mockResolvedValue(item) } as any,
      {
        execute: vi.fn((handler) =>
          handler({
            paymentLinkRepository: { findPublicByTokenForUpdate: vi.fn().mockResolvedValue(item) },
            pixChargeRepository: {
              findByIdAndStoreIdForUpdate: vi.fn().mockResolvedValue(makePixChargeFromItem(item)),
              update: vi.fn(),
            },
            storeRepository: { findById: vi.fn().mockResolvedValue(makeStore()) },
            customerRepository: {
              findByDocument: vi.fn(),
              save: vi.fn(),
            },
            paymentRepository: { save: vi.fn() },
          }),
        ),
      } as any,
      { calculate: vi.fn() } as any,
    );

    await expect(
      useCase.execute({
        publicToken: 'public-token',
        environment: Environment.TEST,
      }),
    ).rejects.toMatchObject({ code: 'CUSTOMER_DOCUMENT_REQUIRED' });
  });

  it('does not create a second confirmed payment when the locked PixCharge is already paid', async () => {
    const item = makePaymentLinkListItem();
    const pixCharge = makePixChargeFromItem(item);
    let savedPayment: Payment | null = null;
    const paymentRepository = {
      save: vi.fn(async (payment: Payment) => {
        savedPayment = payment;
      }),
      update: vi.fn(),
      findByPixChargeIdAndStoreId: vi.fn(async () =>
        savedPayment ? [savedPayment] : [],
      ),
    };
    const account = {
      id: 'account-1',
      totalBalance: 4910,
      addToPending: vi.fn(),
    };
    const useCase = new PayPaymentLinkUseCase(
      { findPublicByToken: vi.fn().mockResolvedValue(item) } as any,
      {
        execute: vi.fn((handler) =>
          handler({
            paymentLinkRepository: { findPublicByTokenForUpdate: vi.fn().mockResolvedValue(item) },
            pixChargeRepository: {
              findByIdAndStoreIdForUpdate: vi.fn().mockResolvedValue(pixCharge),
              update: vi.fn(),
            },
            storeRepository: { findById: vi.fn().mockResolvedValue(makeStore()) },
            customerRepository: {
              findByDocument: vi.fn().mockResolvedValue(null),
              save: vi.fn(),
              findById: vi.fn().mockResolvedValue({
                name: 'Ana',
                email: undefined,
                document: { value: '52998224725' },
              }),
            },
            paymentRepository,
            accountRepository: {
              findByStoreIdForUpdate: vi.fn().mockResolvedValue(account),
              update: vi.fn(),
            },
            transactionRepository: { save: vi.fn() },
            receiptRepository: {
              incrementCounter: vi.fn().mockResolvedValue(1),
              save: vi.fn(),
            },
            outboxWriter: { save: vi.fn() },
          }),
        ),
      } as any,
      { calculate: vi.fn().mockReturnValue({ feeInCents: 90, netAmountInCents: 4910 }) } as any,
    );

    const first = await useCase.execute({
      publicToken: 'public-token',
      environment: Environment.TEST,
      customer: { document: '52998224725', name: 'Ana' },
    });
    const second = await useCase.execute({
      publicToken: 'public-token',
      environment: Environment.TEST,
      customer: { document: '52998224725', name: 'Ana' },
    });

    expect(second.payment.id).toBe(first.payment.id);
    expect(paymentRepository.save).toHaveBeenCalledOnce();
    expect(account.addToPending).toHaveBeenCalledOnce();
  });

  it('rejects public payment link simulation for LIVE links before saving payment', async () => {
    const item = {
      ...makePaymentLinkListItem(),
      environment: Environment.LIVE,
    };
    const paymentRepository = {
      save: vi.fn(),
    };
    const useCase = new PayPaymentLinkUseCase(
      { findPublicByToken: vi.fn().mockResolvedValue(item) } as any,
      {
        execute: vi.fn((handler) =>
          handler({
            paymentLinkRepository: { findPublicByTokenForUpdate: vi.fn().mockResolvedValue(item) },
            pixChargeRepository: {
              findByIdAndStoreIdForUpdate: vi.fn(),
              update: vi.fn(),
            },
            paymentRepository,
          }),
        ),
      } as any,
      { calculate: vi.fn() } as any,
    );

    await expect(
      useCase.execute({
        publicToken: 'public-token',
        environment: Environment.TEST,
      }),
    ).rejects.toMatchObject({ code: 'LIVE_ENVIRONMENT_NOT_ALLOWED' });

    expect(paymentRepository.save).not.toHaveBeenCalled();
  });
});

function makeCancelPaymentLinkSut(options: { linkEnvironment: Environment }) {
  const link = {
    pixChargeId: 'charge-1',
    environment: options.linkEnvironment,
    cancel: vi.fn(),
  };
  const charge = makePixChargeFromItem(makePaymentLinkListItem());
  const paymentLinkRepository = {
    findByIdAndStoreId: vi.fn(),
    findByIdAndStoreIdForUpdate: vi.fn().mockResolvedValue(link),
    update: vi.fn(),
  };
  const pixChargeRepository = {
    findByIdAndStoreId: vi.fn(),
    findByIdAndStoreIdForUpdate: vi.fn().mockResolvedValue(charge),
    update: vi.fn(),
  };
  const unitOfWork = {
    execute: vi.fn((handler) =>
      handler({
        paymentLinkRepository,
        pixChargeRepository,
      }),
    ),
  };
  const useCase = new CancelPaymentLinkUseCase(
    {} as never,
    {} as never,
    unitOfWork as never,
  );

  return {
    useCase,
    link,
    charge,
    paymentLinkRepository,
    pixChargeRepository,
  };
}

function makeStore() {
  return {
    id: 'store-1',
    name: 'Hockpay Store',
    isActive: true,
    isApproved: true,
    feePercent: 0,
    feeFixed: 90,
  };
}

function makePaymentLinkListItem() {
  const now = new Date('2026-05-15T12:00:00.000Z');
  return {
    id: 'link-1',
    storeId: 'store-1',
    pixChargeId: 'charge-1',
    publicToken: 'public-token',
    amount: 5000,
    currency: 'BRL',
    environment: Environment.TEST,
    title: 'Venda avulsa',
    description: null,
    internalReference: 'order-1',
    expiresAt: null,
    openedAt: null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
    checkoutUrl: 'http://localhost:3333/pay/public-token',
    status: 'ACTIVE',
    paymentId: null,
    paymentStatus: null,
    pixCharge: {
      id: 'charge-1',
      storeId: 'store-1',
      amount: 5000,
      currency: 'BRL',
      status: PixChargeStatus.OPEN,
      pixQrCode: 'qr-code',
      pixCopyPaste: 'pix-copy-paste',
      pixTxId: 'pix-tx-id',
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
    },
    failedPaymentCount: 0,
    lastPaymentId: null,
    lastPaymentStatus: null,
    lastPayment: null,
    lastFailedAt: null,
    attempts: [],
  };
}

function makePixChargeFromItem(item: any) {
  return PixCharge.reconstitute({
    id: item.pixCharge.id,
    storeId: item.pixCharge.storeId,
    amount: item.pixCharge.amount,
    currency: item.pixCharge.currency,
    status: item.pixCharge.status,
    pixQrCode: item.pixCharge.pixQrCode,
    pixCopyPaste: item.pixCharge.pixCopyPaste,
    pixTxId: item.pixCharge.pixTxId,
    expiresAt: item.pixCharge.expiresAt,
    paidAt: item.pixCharge.paidAt,
    cancelledAt: item.pixCharge.cancelledAt,
    createdAt: item.pixCharge.createdAt,
    updatedAt: item.pixCharge.updatedAt,
  });
}
