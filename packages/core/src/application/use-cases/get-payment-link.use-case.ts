import { PaymentLinkListItem } from '../../domain/entities/payment-link.entity';
import { IPaymentLinkRepository } from '../../domain/repositories/payment-link.repository.interface';
export { PaymentLinkNotFoundError } from '../../domain/errors/payment-link-not-found.error';
import { PaymentLinkNotFoundError } from '../../domain/errors/payment-link-not-found.error';
import { Environment } from '../../domain/value-objects/environment.vo';

export class GetPaymentLinkUseCase {
  constructor(private readonly repository: IPaymentLinkRepository) {}

  async execute(input: {
    storeId: string;
    paymentLinkId: string;
    environment: Environment;
  }): Promise<{ paymentLink: PaymentLinkListItem }> {
    const item = await this.repository.findListItemByIdAndStoreId(
      input.paymentLinkId,
      input.storeId,
    );
    if (!item || item.environment !== input.environment) {
      throw new PaymentLinkNotFoundError(input.paymentLinkId);
    }
    return { paymentLink: item };
  }
}
