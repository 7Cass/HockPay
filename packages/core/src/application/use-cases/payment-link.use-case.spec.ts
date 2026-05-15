import { describe, expect, it, vi } from 'vitest';
import { PixChargeStatus } from '../../domain/entities/pix-charge.entity';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';
import { CreatePaymentLinkUseCase } from './create-payment-link.use-case';
import { OpenPaymentLinkUseCase } from './open-payment-link.use-case';

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
    expect(result.paymentLink.paymentId).toBeNull();
    expect(result.paymentLink.pixCharge.status).toBe(PixChargeStatus.OPEN);
    expect(pixChargeRepository.save).toHaveBeenCalledOnce();
    expect(paymentLinkRepository.save).toHaveBeenCalledOnce();
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
});
