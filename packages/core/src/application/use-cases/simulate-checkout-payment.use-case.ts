import { Payment, PaymentObject } from '../../domain/entities/payment.entity';
import { OutboxEvent } from '../../domain/entities/outbox-event.entity';
import { Environment } from '../../domain/value-objects/environment.vo';
import { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';
import { IOutboxWriter } from '../../domain/repositories/outbox-writer.repository.interface';
import { PaymentNotFoundError } from '../../domain/errors/payment-not-found.error';
import { LiveEnvironmentNotAllowedError } from '../../domain/errors/live-environment-not-allowed.error';
import { InvalidPaymentStatusError } from '../../domain/errors/invalid-payment-status.error';

/**
 * Simulation action type.
 */
export type SimulateAction = 'confirm' | 'expire' | 'fail';

/**
 * Input DTO for SimulateCheckoutPaymentUseCase.
 */
export interface ISimulateCheckoutInput {
  token: string;
  action: SimulateAction;
}

/**
 * Output DTO for SimulateCheckoutPaymentUseCase.
 */
export interface ISimulateCheckoutOutput {
  payment: PaymentObject;
}

/**
 * Use Case: Simulate Checkout Payment
 *
 * This use case allows simulating payment actions via checkout token.
 * It only works for payments created in TEST environment.
 *
 * Actions:
 * - confirm: Simulate a successful payment
 * - expire: Simulate payment expiration
 * - fail: Simulate a failed payment
 *
 * Security:
 * - Only works for TEST environment payments
 * - LIVE payments will receive 403 Forbidden
 */
export class SimulateCheckoutPaymentUseCase {
  constructor(
    private readonly paymentRepository: IPaymentRepository,
    private readonly outboxWriter: IOutboxWriter,
  ) {}

  async execute(input: ISimulateCheckoutInput): Promise<ISimulateCheckoutOutput> {
    // 1. Find payment by checkout token
    const payment = await this.paymentRepository.findByCheckoutToken(input.token);

    if (!payment) {
      throw new PaymentNotFoundError(input.token);
    }

    // 2. Validate environment - only TEST payments can be simulated
    if (payment.environment === Environment.LIVE) {
      throw new LiveEnvironmentNotAllowedError();
    }

    // 3. Execute the requested action
    let eventType: string;

    try {
      switch (input.action) {
        case 'confirm':
          payment.confirm();
          eventType = 'payment.confirmed';
          break;

        case 'expire':
          payment.expire();
          eventType = 'payment.expired';
          break;

        case 'fail':
          payment.fail('Simulated failure');
          eventType = 'payment.failed';
          break;

        default:
          throw new Error(`Invalid simulation action: ${input.action}`);
      }
    } catch (error) {
      if (error instanceof InvalidPaymentStatusError) {
        // Payment is not in a valid state for this action
        throw error;
      }
      throw error;
    }

    // 4. Persist the payment
    await this.paymentRepository.update(payment);

    // 5. Create outbox event for webhook notification
    const outboxEvent = OutboxEvent.create({
      aggregateType: 'Payment',
      aggregateId: payment.id,
      eventType,
      payload: payment.toObject() as unknown as Record<string, unknown>,
    });
    await this.outboxWriter.save(outboxEvent);

    // 6. Return the updated payment
    return {
      payment: payment.toObject(),
    };
  }
}
