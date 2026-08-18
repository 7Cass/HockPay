import { PaymentLinkListItem } from "../../domain/entities/payment-link.entity";
import { IPaymentLinkRepository } from "../../domain/repositories/payment-link.repository.interface";
export { PaymentLinkNotFoundError } from "../../domain/errors/payment-link-not-found.error";
import { PaymentLinkNotFoundError } from "../../domain/errors/payment-link-not-found.error";

export class GetPaymentLinkUseCase {
  constructor(private readonly repository: IPaymentLinkRepository) {}

  async execute(input: {
    storeId: string;
    paymentLinkId: string;
    environment?: import("../../domain/value-objects/environment.vo").Environment;
  }): Promise<{ paymentLink: PaymentLinkListItem }> {
    const item = await this.repository.findListItemByIdAndStoreId(
      input.paymentLinkId,
      input.storeId,
    );
    if (!item) throw new PaymentLinkNotFoundError(input.paymentLinkId);
    if (input.environment && item.environment !== input.environment) {
      throw new PaymentLinkNotFoundError(input.paymentLinkId);
    }
    return { paymentLink: item };
  }
}
