import { PaymentLinkListItem } from "../../domain/entities/payment-link.entity";
import { IPaymentLinkRepository } from "../../domain/repositories/payment-link.repository.interface";

export class PaymentLinkNotFoundError extends Error {
  readonly code = "PAYMENT_LINK_NOT_FOUND";

  constructor(idOrToken: string) {
    super(`Payment link not found: ${idOrToken}`);
  }
}

export class GetPaymentLinkUseCase {
  constructor(private readonly repository: IPaymentLinkRepository) {}

  async execute(input: {
    storeId: string;
    paymentLinkId: string;
  }): Promise<{ paymentLink: PaymentLinkListItem }> {
    const item = await this.repository.findListItemByIdAndStoreId(
      input.paymentLinkId,
      input.storeId,
    );
    if (!item) throw new PaymentLinkNotFoundError(input.paymentLinkId);
    return { paymentLink: item };
  }
}
