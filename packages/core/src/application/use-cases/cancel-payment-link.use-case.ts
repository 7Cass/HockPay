import { IPaymentLinkRepository } from "../../domain/repositories/payment-link.repository.interface";
import { IPixChargeRepository } from "../../domain/repositories/pix-charge.repository.interface";
import { PixChargeStatus } from "../../domain/entities/pix-charge.entity";
import { PaymentLinkNotFoundError } from "./get-payment-link.use-case";

export class PaymentLinkCannotBeCancelledError extends Error {
  readonly code = "PAYMENT_LINK_CANNOT_BE_CANCELLED";

  constructor() {
    super("Payment link cannot be cancelled after payment is paid");
  }
}

export class CancelPaymentLinkUseCase {
  constructor(
    private readonly paymentLinkRepository: IPaymentLinkRepository,
    private readonly pixChargeRepository: IPixChargeRepository,
  ) {}

  async execute(input: {
    storeId: string;
    paymentLinkId: string;
    requestId?: string;
  }): Promise<void> {
    const link = await this.paymentLinkRepository.findByIdAndStoreId(
      input.paymentLinkId,
      input.storeId,
    );
    if (!link) throw new PaymentLinkNotFoundError(input.paymentLinkId);

    const charge = await this.pixChargeRepository.findByIdAndStoreId(
      link.pixChargeId,
      input.storeId,
    );

    if (charge?.status === PixChargeStatus.PAID) {
      throw new PaymentLinkCannotBeCancelledError();
    }

    link.cancel();
    await this.paymentLinkRepository.update(link);

    if (charge?.isOpen()) {
      charge.cancel();
      await this.pixChargeRepository.update(charge);
    }
  }
}
