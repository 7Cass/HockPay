import { Payment, PaymentMethod, PaymentObject } from "../../domain/entities/payment.entity";
import { OutboxEvent } from "../../domain/entities/outbox-event.entity";
import { PaymentLinkStatus } from "../../domain/entities/payment-link.entity";
import { PixChargeStatus } from "../../domain/entities/pix-charge.entity";
import { Environment } from "../../domain/value-objects/environment.vo";
import { IUnitOfWork } from "../../domain/repositories/unit-of-work.interface";
import { IPaymentLinkRepository } from "../../domain/repositories/payment-link.repository.interface";
import { FeePolicy } from "../services/fee-policy.service";
import { enrichPaymentAttempt } from "../services/payment-attempt-context.service";
import { ConfirmPaymentUseCase } from "./confirm-payment.use-case";
import { PaymentLinkNotFoundError } from "./get-payment-link.use-case";
import { PaymentLinkUnavailableError } from "./open-payment-link.use-case";

export interface IPayPaymentLinkInput {
  publicToken: string;
  requestId?: string;
  environment: Environment;
}

export interface IPayPaymentLinkOutput {
  payment: PaymentObject;
}

export class PayPaymentLinkUseCase {
  constructor(
    private readonly paymentLinkRepository: IPaymentLinkRepository,
    private readonly unitOfWork: IUnitOfWork,
    private readonly feePolicy: FeePolicy,
    private readonly confirmPaymentUseCase: ConfirmPaymentUseCase,
  ) {}

  async execute(input: IPayPaymentLinkInput): Promise<IPayPaymentLinkOutput> {
    const item = await this.paymentLinkRepository.findPublicByToken(
      input.publicToken,
    );
    if (!item) throw new PaymentLinkNotFoundError(input.publicToken);
    this.ensurePayable(item.status, item.pixCharge.status);

    const created = await this.unitOfWork.execute(async (repos) => {
      const store = await repos.storeRepository.findById(item.storeId);
      if (!store) throw new PaymentLinkUnavailableError("Payment link store is invalid");

      const feeResult = this.feePolicy.calculate({
        amountInCents: item.amount,
        feePercent: store.feePercent,
        feeFixed: store.feeFixed,
      });
      const paymentExpiresAt =
        item.pixCharge.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000);

      const payment = Payment.create({
        storeId: item.storeId,
        pixChargeId: item.pixCharge.id,
        amount: item.amount,
        fee: feeResult.feeInCents,
        netAmount: feeResult.netAmountInCents,
        currency: item.currency,
        description: item.description ?? item.title ?? undefined,
        environment: item.environment ?? input.environment,
        paymentMethod: PaymentMethod.PIX,
        pixCharge: item.pixCharge,
        expiresAt: paymentExpiresAt,
        metadata: {
          origin: "payment_link",
          paymentLinkId: item.id,
          internalReference: item.internalReference ?? undefined,
        },
      });

      await repos.paymentRepository.save(payment);
      const relatedAttempts = await repos.paymentRepository.findByPixChargeIdAndStoreId(
        item.pixCharge.id,
        item.storeId,
      );
      const paymentPayload = enrichPaymentAttempt(
        payment.toObject(),
        relatedAttempts.map((attempt) => attempt.toObject()),
      );

      const outboxEvent = OutboxEvent.create({
        aggregateType: "Payment",
        aggregateId: payment.id,
        eventType: "payment.created",
        requestId: input.requestId,
        storeId: payment.storeId,
        payload: paymentPayload as unknown as Record<string, unknown>,
      });
      await repos.outboxWriter.save(outboxEvent);

      return paymentPayload;
    });

    return this.confirmPaymentUseCase.execute({
      storeId: created.storeId,
      paymentId: created.id,
      requestId: input.requestId,
    });
  }

  private ensurePayable(
    linkStatus: PaymentLinkStatus,
    pixChargeStatus: PixChargeStatus,
  ): void {
    if (
      (linkStatus !== "ACTIVE" && linkStatus !== "OPENED") ||
      pixChargeStatus !== PixChargeStatus.OPEN
    ) {
      throw new PaymentLinkUnavailableError("Payment link is not payable");
    }
  }
}
