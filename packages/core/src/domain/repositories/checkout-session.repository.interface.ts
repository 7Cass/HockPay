import { CheckoutSession } from '../entities/checkout-session.entity';

export interface ICheckoutSessionRepository {
  save(session: CheckoutSession): Promise<void>;
  findById(id: string): Promise<CheckoutSession | null>;
  findByToken(token: string): Promise<CheckoutSession | null>;
  claimOpenByToken(token: string, now: Date): Promise<CheckoutSession | null>;
  expireOpenByToken(token: string, now: Date): Promise<CheckoutSession | null>;
  findByPaymentId(paymentId: string): Promise<CheckoutSession | null>;
}
