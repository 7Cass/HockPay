import { ICheckoutSessionRepository } from "../../domain/repositories/checkout-session.repository.interface";
import { IStoreRepository } from "../../domain/repositories/store.repository.interface";
import {
  CreatePaymentUseCase,
  PaymentCustomerInput,
} from "./create-payment.use-case";
import { Environment } from "../../domain/value-objects/environment.vo";

export interface IFulfillCheckoutSessionInput {
  token: string;
  customer: PaymentCustomerInput;
  environment: Environment;
}

export interface IFulfillCheckoutSessionOutput {
  sessionId: string;
  paymentId: string;
}

export class FulfillCheckoutSessionUseCase {
  constructor(
    private readonly sessionRepository: ICheckoutSessionRepository,
    private readonly createPaymentUseCase: CreatePaymentUseCase,
    private readonly storeRepository: IStoreRepository,
  ) {}

  async execute(
    input: IFulfillCheckoutSessionInput,
  ): Promise<IFulfillCheckoutSessionOutput> {
    const session = await this.sessionRepository.findByToken(input.token);

    if (!session) {
      throw new Error("Checkout session not found or invalid token");
    }

    if (session.status !== "OPEN") {
      throw new Error(
        `Checkout session cannot be fulfilled because its status is ${session.status}`,
      );
    }

    if (new Date() > session.expiresAt) {
      session.expire();
      await this.sessionRepository.save(session);
      throw new Error("Checkout session has expired");
    }

    const store = await this.storeRepository.findById(session.storeId);

    // 1. Delegate strictly to CreatePaymentUseCase which now acts as our internal Payment engine
    // Since the externalId is irrelevant here, we just pass the necessary data
    const paymentResult = await this.createPaymentUseCase.execute({
      storeId: session.storeId,
      amount: session.amount,
      description: session.description ?? undefined,
      customer: input.customer,
      environment: input.environment,
      metadata: session.metadata ?? undefined,
      expiresAt: session.expiresAt, // We sync the payment expiration with the session expiration
    });

    const paymentId = paymentResult.payment.id;

    // 2. Mark session as COMPLETED and attach Payment
    session.fulfill(paymentId);
    await this.sessionRepository.save(session);

    return {
      sessionId: session.id,
      paymentId: paymentId,
    };
  }
}
