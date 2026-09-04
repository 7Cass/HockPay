import { Payment, PaymentMethod, PaymentObject } from '../../domain/entities/payment.entity';
import { OutboxEvent } from '../../domain/entities/outbox-event.entity';
import { PaymentLinkListItem, PaymentLinkStatus } from '../../domain/entities/payment-link.entity';
import { PixChargeStatus } from '../../domain/entities/pix-charge.entity';
import { Environment } from '../../domain/value-objects/environment.vo';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';
import { IPaymentLinkRepository } from '../../domain/repositories/payment-link.repository.interface';
import { LiveEnvironmentNotAllowedError } from '../../domain/errors/live-environment-not-allowed.error';
import { FeePolicy } from '../services/fee-policy.service';
import { forkLineItemSnapshot } from '../../domain/entities/line-item.entity';
import { enrichPaymentAttempt } from '../services/payment-attempt-context.service';
import { PaymentLinkNotFoundError } from '../../domain/errors/payment-link-not-found.error';
import { PaymentLinkUnavailableError } from '../../domain/errors/payment-link-unavailable.error';

export interface IFailPaymentLinkInput {
  publicToken: string;
  requestId?: string;
  environment: Environment;
  reason?: string;
}

export interface IFailPaymentLinkOutput {
  payment: PaymentObject;
}

export class FailPaymentLinkUseCase {
  constructor(
    private readonly paymentLinkRepository: IPaymentLinkRepository,
    private readonly unitOfWork: IUnitOfWork,
    private readonly feePolicy: FeePolicy,
  ) {}

  async execute(input: IFailPaymentLinkInput): Promise<IFailPaymentLinkOutput> {
    return this.unitOfWork.execute(async (repos) => {
      const item = await repos.paymentLinkRepository.findPublicByTokenForUpdate(input.publicToken);
      if (!item) throw new PaymentLinkNotFoundError(input.publicToken);

      this.ensureSimulationAllowed(input.environment, item.environment);
      this.ensureFailable(item.status, item.pixCharge.status);

      const pixCharge = await repos.pixChargeRepository.findByIdAndStoreIdForUpdate(
        item.pixCharge.id,
        item.storeId,
      );
      if (!pixCharge) {
        throw new PaymentLinkUnavailableError('Payment link Pix charge is invalid');
      }
      if (pixCharge.hasExpired()) {
        pixCharge.expire();
        await repos.pixChargeRepository.update(pixCharge);
        throw new PaymentLinkUnavailableError('Payment link has expired');
      }
      if (!pixCharge.isOpen()) {
        throw new PaymentLinkUnavailableError('Payment link is not failable');
      }

      const store = await repos.storeRepository.findById(item.storeId);
      if (!store) throw new PaymentLinkUnavailableError('Payment link store is invalid');

      const payment = this.createAttempt(input, item, pixCharge.toObject(), store);

      payment.fail(input.reason ?? 'Payment link simulated failure');
      await repos.paymentRepository.save(payment);
      if (payment.items.length > 0) {
        await repos.paymentRepository.saveItems(payment.id, payment.items);
      }
      const relatedAttempts = await repos.paymentRepository.findByPixChargeIdAndStoreId(
        item.pixCharge.id,
        item.storeId,
      );
      const paymentPayload = enrichPaymentAttempt(
        payment.toObject(),
        relatedAttempts.map((attempt) => attempt.toObject()),
      );

      const outboxEvent = OutboxEvent.create({
        aggregateType: 'Payment',
        aggregateId: payment.id,
        eventType: 'payment.failed',
        requestId: input.requestId,
        storeId: payment.storeId,
        payload: paymentPayload as unknown as Record<string, unknown>,
      });
      await repos.outboxWriter.save(outboxEvent);

      return {
        payment: paymentPayload,
      };
    });
  }

  private createAttempt(
    input: IFailPaymentLinkInput,
    item: PaymentLinkListItem,
    pixCharge: PaymentLinkListItem['pixCharge'],
    store: { feePercent: number; feeFixed: number },
  ): Payment {
    const feeResult = this.feePolicy.calculate({
      amountInCents: item.amount,
      feePercent: store.feePercent,
      feeFixed: store.feeFixed,
    });
    const paymentExpiresAt = pixCharge.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000);

    return Payment.create({
      storeId: item.storeId,
      pixChargeId: pixCharge.id,
      amount: item.amount,
      fee: feeResult.feeInCents,
      netAmount: feeResult.netAmountInCents,
      currency: item.currency,
      description: item.description ?? item.title ?? undefined,
      environment: item.environment ?? input.environment,
      paymentMethod: PaymentMethod.PIX,
      pixCharge,
      // Tentativa falha carrega a mesma cesta da tentativa que deu certo:
      // o dashboard mostra o que o comprador tentou levar.
      items: item.items.map(forkLineItemSnapshot),
      expiresAt: paymentExpiresAt,
      metadata: {
        origin: 'payment_link',
        paymentLinkId: item.id,
        internalReference: item.internalReference ?? undefined,
      },
    });
  }

  private ensureSimulationAllowed(
    requestEnvironment: Environment,
    linkEnvironment: Environment,
  ): void {
    if (requestEnvironment === Environment.LIVE || linkEnvironment === Environment.LIVE) {
      throw new LiveEnvironmentNotAllowedError();
    }
  }

  private ensureFailable(linkStatus: PaymentLinkStatus, pixChargeStatus: PixChargeStatus): void {
    if (
      (linkStatus !== 'ACTIVE' && linkStatus !== 'OPENED') ||
      pixChargeStatus !== PixChargeStatus.OPEN
    ) {
      throw new PaymentLinkUnavailableError('Payment link is not failable');
    }
  }
}
