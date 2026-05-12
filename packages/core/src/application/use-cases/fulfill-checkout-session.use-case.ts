import { ICheckoutSessionRepository } from "../../domain/repositories/checkout-session.repository.interface";
import {
  CreatePaymentUseCase,
  CustomerPromotionPolicy,
  PaymentCustomerInput,
} from "./create-payment.use-case";
import { Environment } from "../../domain/value-objects/environment.vo";
import { Document } from "../../domain/value-objects/document.vo";
import { CustomerCollectionMode } from "../../domain/entities/checkout-session.entity";

export interface IFulfillCheckoutSessionInput {
  token: string;
  requestId?: string;
  customer?: PaymentCustomerInput;
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

    const customer = resolveCheckoutCustomer(session.prefillCustomer, input.customer);

    if (
      session.customerCollectionMode === CustomerCollectionMode.IDENTIFIED &&
      !customer.document
    ) {
      throw new Error("Customer document is required for identified checkout sessions");
    }

    if (customer.document && !Document.create(customer.document)) {
      throw new Error("Customer document must be a valid CPF or CNPJ");
    }

    const paymentResult = await this.createPaymentUseCase.execute({
      storeId: session.storeId,
      amount: session.amount,
      description: session.description ?? undefined,
      customer,
      requestId: input.requestId,
      customerPromotionPolicy: CustomerPromotionPolicy.CHECKOUT_SESSION,
      environment: input.environment,
      metadata: session.metadata ?? undefined,
      expiresAt: session.expiresAt,
    });

    const paymentId = paymentResult.payment.id;

    session.fulfill(paymentId);
    await this.sessionRepository.save(session);

    return {
      sessionId: session.id,
      paymentId: paymentId,
    };
  }
}

function resolveCheckoutCustomer(
  prefillCustomer: PaymentCustomerInput | null,
  incomingCustomer?: PaymentCustomerInput,
): PaymentCustomerInput {
  return {
    externalId: prefillCustomer?.externalId,
    document: prefillCustomer?.document ?? incomingCustomer?.document,
    name: prefillCustomer?.name ?? incomingCustomer?.name,
    email: prefillCustomer?.email ?? incomingCustomer?.email,
  };
}
