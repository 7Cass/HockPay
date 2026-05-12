import { PaymentObject } from "../../domain/entities/payment.entity";
import { Environment } from "../../domain/value-objects/environment.vo";
import { IPaymentRepository } from "../../domain/repositories/payment.repository.interface";
import { ICheckoutSessionRepository } from "../../domain/repositories/checkout-session.repository.interface";
import { PaymentNotFoundError } from "../../domain/errors/payment-not-found.error";
import { LiveEnvironmentNotAllowedError } from "../../domain/errors/live-environment-not-allowed.error";
import { ConfirmPaymentUseCase } from "./confirm-payment.use-case";
import { ExpirePaymentUseCase } from "./expire-payment.use-case";
import { FailPaymentUseCase } from "./fail-payment.use-case";

/**
 * Simulation action type.
 */
export type SimulateAction = "confirm" | "expire" | "fail";

/**
 * Input DTO for SimulateCheckoutPaymentUseCase.
 */
export interface ISimulateCheckoutInput {
  paymentId: string;
  checkoutToken: string;
  action: SimulateAction;
  requestId?: string;
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
 * This use case allows simulating payment actions via payment ID.
 * It only works for payments created in TEST environment.
 *
 * Actions:
 * - confirm: Delegates to ConfirmPaymentUseCase (creates receipt, updates account, etc.)
 * - expire: Delegates to ExpirePaymentUseCase
 * - fail: Delegates to FailPaymentUseCase
 *
 * Security:
 * - Only works for TEST environment payments
 * - LIVE payments will receive 403 Forbidden
 */
export class SimulateCheckoutPaymentUseCase {
  constructor(
    private readonly paymentRepository: IPaymentRepository,
    private readonly checkoutSessionRepository: ICheckoutSessionRepository,
    private readonly confirmPaymentUseCase: ConfirmPaymentUseCase,
    private readonly expirePaymentUseCase: ExpirePaymentUseCase,
    private readonly failPaymentUseCase: FailPaymentUseCase,
  ) {}

  async execute(
    input: ISimulateCheckoutInput,
  ): Promise<ISimulateCheckoutOutput> {
    const session = await this.checkoutSessionRepository.findByToken(
      input.checkoutToken,
    );

    if (!session?.paymentId || session.paymentId !== input.paymentId) {
      throw new PaymentNotFoundError(input.paymentId);
    }

    // Find payment to validate environment before delegating
    const payment = await this.paymentRepository.findById(input.paymentId);

    if (!payment) {
      throw new PaymentNotFoundError(input.paymentId);
    }

    if (payment.storeId !== session.storeId) {
      throw new PaymentNotFoundError(input.paymentId);
    }

    // Validate environment - only TEST payments can be simulated
    if (payment.environment === Environment.LIVE) {
      throw new LiveEnvironmentNotAllowedError();
    }

    switch (input.action) {
      case "confirm":
        return this.confirmPaymentUseCase.execute({
          storeId: payment.storeId,
          paymentId: payment.id,
          requestId: input.requestId,
        });

      case "expire":
        return this.expirePaymentUseCase.execute({
          paymentId: payment.id,
          requestId: input.requestId,
        });

      case "fail":
        return this.failPaymentUseCase.execute({
          paymentId: payment.id,
          storeId: payment.storeId,
          requestId: input.requestId,
          reason: "Simulated failure",
        });

      default:
        throw new Error(`Invalid simulation action: ${input.action}`);
    }
  }
}
