import { ICheckoutSessionRepository } from '../../domain/repositories/checkout-session.repository.interface';
import { CheckoutSession } from '../../domain/entities/checkout-session.entity';
import { IStoreRepository } from '../../domain/repositories/store.repository.interface';
import { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';
import { PaymentObject } from '../../domain/entities/payment.entity';

export interface IGetCheckoutSessionOutput {
  id: string;
  amount: number;
  currency: string;
  description: string | null;
  status: string;
  expiresAt: Date;
  store: {
    name: string;
  };
  paymentId: string | null;
  payment?: PaymentObject;
  successUrl: string | null;
  cancelUrl: string | null;
}

export class GetCheckoutSessionUseCase {
  constructor(
    private readonly sessionRepository: ICheckoutSessionRepository,
    private readonly storeRepository: IStoreRepository,
    private readonly paymentRepository: IPaymentRepository,
  ) { }

  async execute(token: string): Promise<IGetCheckoutSessionOutput> {
    const session = await this.sessionRepository.findByToken(token);

    if (!session) {
      throw new Error('Checkout session not found or invalid token');
    }

    const store = await this.storeRepository.findById(session.storeId);
    if (!store) {
      throw new Error('Store associated with this session is invalid');
    }

    // Lazy expiration check
    if (session.status === 'OPEN' && new Date() > session.expiresAt) {
      session.expire();
      await this.sessionRepository.save(session);
    }

    let paymentObj: PaymentObject | undefined;
    if (session.paymentId) {
      const payment = await this.paymentRepository.findById(session.paymentId);
      if (payment) {
        paymentObj = payment.toObject();
      }
    }

    return {
      id: session.id,
      amount: session.amount,
      currency: session.currency,
      description: session.description,
      status: session.status,
      expiresAt: session.expiresAt,
      store: {
        name: store.name,
      },
      paymentId: session.paymentId,
      payment: paymentObj,
      successUrl: session.successUrl,
      cancelUrl: session.cancelUrl,
    };
  }
}
