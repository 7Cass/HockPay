import {
  CreatePaymentUseCase,
  ICreatePaymentInput,
  CustomerPromotionPolicy,
  PaymentCustomerInput,
} from "./create-payment.use-case";
import { Environment } from "../../domain/value-objects/environment.vo";
import { Document } from "../../domain/value-objects/document.vo";
import { CustomerCollectionMode } from "../../domain/entities/checkout-session.entity";
import { IUnitOfWork } from "../../domain/repositories/unit-of-work.interface";

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
    private readonly unitOfWork: IUnitOfWork,
    private readonly createPaymentUseCase: CreatePaymentUseCase,
  ) {}

  async execute(
    input: IFulfillCheckoutSessionInput,
  ): Promise<IFulfillCheckoutSessionOutput> {
    const result = await this.unitOfWork.execute(async (repos) => {
      const now = new Date();
      const session = await repos.checkoutSessionRepository.claimOpenByToken(
        input.token,
        now,
      );

      if (!session) {
        const currentSession = await repos.checkoutSessionRepository.findByToken(
          input.token,
        );

        if (!currentSession) {
          throw new Error("Checkout session not found or invalid token");
        }

        if (currentSession.status === "OPEN" && now > currentSession.expiresAt) {
          await repos.checkoutSessionRepository.expireOpenByToken(
            input.token,
            now,
          );
          throw new Error("Checkout session has expired");
        }

        throw new Error(
          `Checkout session cannot be fulfilled because its status is ${currentSession.status}`,
        );
      }

      const customer = resolveCheckoutCustomer(
        session.prefillCustomer,
        input.customer,
      );

      if (
        session.customerCollectionMode === CustomerCollectionMode.IDENTIFIED &&
        !customer.document
      ) {
        throw new Error("Customer document is required for identified checkout sessions");
      }

      if (customer.document && !Document.create(customer.document)) {
        throw new Error("Customer document must be a valid CPF or CNPJ");
      }

      const paymentInput: ICreatePaymentInput = {
        storeId: session.storeId,
        amount: session.amount,
        description: session.description ?? undefined,
        customer,
        requestId: input.requestId,
        customerPromotionPolicy: CustomerPromotionPolicy.CHECKOUT_SESSION,
        environment: session.environment ?? input.environment,
        metadata: session.metadata ?? undefined,
        items: session.items,
        expiresAt: session.expiresAt,
      };
      const paymentResult = await this.createPaymentUseCase.executeInTransaction(
        paymentInput,
        repos,
      );

      const paymentId = paymentResult.payment.id;

      session.fulfill(paymentId);
      await repos.checkoutSessionRepository.save(session);

      return {
        output: {
          sessionId: session.id,
          paymentId: paymentId,
        },
        paymentInput,
        paymentResult,
      };
    });

    await this.createPaymentUseCase.scheduleExpirationAfterCommit(
      result.paymentInput,
      result.paymentResult,
    );

    return result.output;
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
