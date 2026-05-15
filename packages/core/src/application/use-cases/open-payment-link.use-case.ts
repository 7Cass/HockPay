import {
  PaymentLinkListItem,
  PaymentLinkStatus,
} from "../../domain/entities/payment-link.entity";
import { PixChargeObject } from "../../domain/entities/pix-charge.entity";
import { PaymentObject } from "../../domain/entities/payment.entity";
import { IPaymentLinkRepository } from "../../domain/repositories/payment-link.repository.interface";
import { PaymentLinkNotFoundError } from "./get-payment-link.use-case";

export class PaymentLinkUnavailableError extends Error {
  readonly code = "PAYMENT_LINK_UNAVAILABLE";

  constructor(message: string) {
    super(message);
  }
}

export interface IOpenPaymentLinkOutput {
  paymentLink: {
    id: string;
    publicToken: string;
    amount: number;
    currency: string;
    title: string | null;
    description: string | null;
    status: PaymentLinkStatus;
    expiresAt: Date | null;
    cancelledAt: Date | null;
  };
  pixCharge: PixChargeObject;
  lastPayment?: PaymentObject | null;
  actions: {
    canPay: boolean;
    canFail: boolean;
  };
}

export class OpenPaymentLinkUseCase {
  constructor(private readonly paymentLinkRepository: IPaymentLinkRepository) {}

  async execute(input: {
    publicToken: string;
  }): Promise<IOpenPaymentLinkOutput> {
    const item = await this.paymentLinkRepository.findPublicByToken(
      input.publicToken,
    );

    if (!item) throw new PaymentLinkNotFoundError(input.publicToken);
    if (item.status === "CANCELLED") {
      throw new PaymentLinkUnavailableError("Payment link has been cancelled");
    }
    if (item.status === "EXPIRED") {
      throw new PaymentLinkUnavailableError("Payment link has expired");
    }

    return {
      paymentLink: {
        id: item.id,
        publicToken: item.publicToken,
        amount: item.amount,
        currency: item.currency,
        title: item.title,
        description: item.description,
        status: item.status,
        expiresAt: item.expiresAt,
        cancelledAt: item.cancelledAt,
      },
      pixCharge: item.pixCharge,
      lastPayment: item.lastPayment ?? null,
      actions: {
        canPay: item.status === "ACTIVE" || item.status === "OPENED",
        canFail: item.status === "ACTIVE" || item.status === "OPENED",
      },
    };
  }
}
