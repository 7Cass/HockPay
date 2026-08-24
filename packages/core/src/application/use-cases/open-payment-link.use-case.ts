import { PaymentLinkListItem, PaymentLinkStatus } from '../../domain/entities/payment-link.entity';
import { PixChargeObject } from '../../domain/entities/pix-charge.entity';
import { PaymentObject } from '../../domain/entities/payment.entity';
import { IPaymentLinkRepository } from '../../domain/repositories/payment-link.repository.interface';
import { Environment } from '../../domain/value-objects/environment.vo';
import { PaymentLinkNotFoundError } from '../../domain/errors/payment-link-not-found.error';
import { PaymentLinkUnavailableError } from '../../domain/errors/payment-link-unavailable.error';
export { PaymentLinkUnavailableError } from '../../domain/errors/payment-link-unavailable.error';

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

  async execute(input: { publicToken: string }): Promise<IOpenPaymentLinkOutput> {
    const item = await this.paymentLinkRepository.findPublicByToken(input.publicToken);

    if (!item) throw new PaymentLinkNotFoundError(input.publicToken);
    if (item.status === 'CANCELLED') {
      throw new PaymentLinkUnavailableError('Payment link has been cancelled');
    }
    if (item.status === 'EXPIRED') {
      throw new PaymentLinkUnavailableError('Payment link has expired');
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
        canPay: this.canSimulate(item),
        canFail: this.canSimulate(item),
      },
    };
  }

  private canSimulate(item: PaymentLinkListItem): boolean {
    return (
      item.environment === Environment.TEST &&
      (item.status === 'ACTIVE' || item.status === 'OPENED')
    );
  }
}
