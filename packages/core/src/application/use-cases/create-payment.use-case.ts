import {
  Payment,
  PaymentObject,
  PaymentMethod,
} from "../../domain/entities/payment.entity";
import { LineItemObject } from "../../domain/entities/line-item.entity";
import { PixCharge } from "../../domain/entities/pix-charge.entity";
import { OutboxEvent } from "../../domain/entities/outbox-event.entity";
import { Document } from "../../domain/value-objects/document.vo";
import { Environment } from "../../domain/value-objects/environment.vo";
import {
  ITransactedRepositories,
  IUnitOfWork,
} from "../../domain/repositories/unit-of-work.interface";
import { IPixQrCodeGeneratorPort } from "../ports/pix-qr-code-generator.port";
import { IExpirationQueuePort } from "../ports/expiration-queue.port";
import { FeePolicy } from "../services/fee-policy.service";
import { resolvePixMerchantCity } from "../services/pix-merchant-city";
import { StoreNotFoundError } from "../../domain/errors/store-not-found.error";
import { StoreInactiveError } from "../../domain/errors/store-inactive.error";
import { StoreNotApprovedError } from "../../domain/errors/store-not-approved.error";
import { ExternalIdAlreadyExistsError } from "../../domain/errors/external-id-already-exists.error";
import { UnsupportedPaymentMethodError } from "../../domain/errors/unsupported-payment-method.error";
import { Customer } from "../../domain/entities/customer.entity";
import { CustomerIdentityConflictError } from "../../domain/errors/customer-identity-conflict.error";

/**
 * Customer data provided in the payment creation payload.
 * Customer will be created on-the-fly if not exists.
 */
export interface PaymentCustomerInput {
  externalId?: string;
  document?: string;
  name?: string;
  email?: string;
  phone?: string;
  street?: string;
  number?: string;
  complement?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export enum CustomerPromotionPolicy {
  DIRECT_PAYMENT_API = "DIRECT_PAYMENT_API",
  CHECKOUT_SESSION = "CHECKOUT_SESSION",
}

/**
 * Input DTO for CreatePaymentUseCase.
 */
export interface ICreatePaymentInput {
  storeId: string;
  requestId?: string;
  externalId?: string;
  amount: number;
  description?: string;
  customer: PaymentCustomerInput;
  customerPromotionPolicy?: CustomerPromotionPolicy;
  environment: Environment;
  paymentMethod?: PaymentMethod;
  paymentDetails?: Record<string, unknown>;
  acquirerId?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
  items?: LineItemObject[];
}

/**
 * Output DTO for CreatePaymentUseCase.
 */
export interface ICreatePaymentOutput {
  payment: PaymentObject;
  customerCreated: boolean;
}

/**
 * Use Case: Create Payment
 *
 * This use case handles creating a new payment with customer on-the-fly creation.
 *
 * Business rules:
 * - Store must exist, be active, and approved
 * - externalId must be unique per store (if provided)
 * - Customer is created on-the-fly if document is provided and not exists
 * - Guest payments without document are allowed internally
 * - Fees are calculated based on store's fee configuration
 * - Pix QR Code is generated following EMV standard
 * - Expiration job is scheduled via BullMQ
 */
export class CreatePaymentUseCase {
  constructor(
    private readonly unitOfWork: IUnitOfWork,
    private readonly pixQrCodeGenerator: IPixQrCodeGeneratorPort,
    private readonly expirationQueue: IExpirationQueuePort,
    private readonly feePolicy: FeePolicy,
    private readonly pixKey: string, // Store's Pix key for receiving payments
  ) {}

  async execute(input: ICreatePaymentInput): Promise<ICreatePaymentOutput> {
    const output = await this.unitOfWork.execute((repos) =>
      this.executeInTransaction(input, repos),
    );

    await this.scheduleExpirationAfterCommit(input, output);

    // 11. Return output
    return output;
  }

  async executeInTransaction(
    input: ICreatePaymentInput,
    repos: ITransactedRepositories,
  ): Promise<ICreatePaymentOutput> {
    const {
      paymentRepository,
      pixChargeRepository,
      customerRepository,
      storeRepository,
      outboxWriter,
    } = repos;

    const paymentMethod = input.paymentMethod ?? PaymentMethod.PIX;
    if (paymentMethod !== PaymentMethod.PIX) {
      throw new UnsupportedPaymentMethodError(paymentMethod);
    }

    const store = await storeRepository.findById(input.storeId);

    if (!store) {
      throw new StoreNotFoundError(input.storeId);
    }

    if (!store.isActive) {
      throw new StoreInactiveError(store.id);
    }

    if (!store.isApproved) {
      throw new StoreNotApprovedError(store.id);
    }

    // 2. Check externalId uniqueness (if provided)
    if (input.externalId) {
      const externalIdExists = await paymentRepository.externalIdExists(
        input.externalId,
        input.storeId,
      );

      if (externalIdExists) {
        throw new ExternalIdAlreadyExistsError(input.externalId);
      }
    }

    // 3. Resolve customer identity and promotion strategy
    const document = input.customer.document
      ? new Document(input.customer.document)
      : undefined;
    const externalId = input.customer.externalId?.trim() || undefined;

    const customerByExternalId = externalId
      ? await customerRepository.findByExternalId(input.storeId, externalId)
      : null;
    const customerByDocument = document
      ? await customerRepository.findByDocument(input.storeId, document.value)
      : null;

    if (
      customerByExternalId &&
      customerByDocument &&
      customerByExternalId.id !== customerByDocument.id
    ) {
      throw new CustomerIdentityConflictError(
        "Provided externalId and document refer to different customers",
      );
    }

    if (
      customerByExternalId &&
      document &&
      !customerByExternalId.document.equals(document)
    ) {
      throw new CustomerIdentityConflictError(
        "Provided document does not match the customer linked to this externalId",
      );
    }

    if (
      customerByDocument &&
      externalId &&
      customerByDocument.externalId &&
      customerByDocument.externalId !== externalId
    ) {
      throw new CustomerIdentityConflictError(
        "Provided externalId does not match the customer linked to this document",
      );
    }

    let customer = customerByExternalId ?? customerByDocument;
    let customerCreated = false;
    const customerPromotionPolicy =
      input.customerPromotionPolicy ??
      CustomerPromotionPolicy.DIRECT_PAYMENT_API;

    if (
      !customer &&
      shouldCreateCustomer(customerPromotionPolicy, input.customer, document)
    ) {
      customer = Customer.create({
        storeId: input.storeId,
        externalId,
        name: input.customer.name,
        email: input.customer.email,
        document: document!,
        phone: input.customer.phone,
        street: input.customer.street,
        number: input.customer.number,
        complement: input.customer.complement,
        city: input.customer.city,
        state: input.customer.state,
        zipCode: input.customer.zipCode,
        country: input.customer.country,
      });
      await customerRepository.save(customer);
      customerCreated = true;
    }

    if (customer) {
      const enrichment: Record<string, string> = {};

      if (!customer.externalId && externalId) {
        enrichment.externalId = externalId;
      }
      if (!customer.name && input.customer.name) {
        enrichment.name = input.customer.name;
      }
      if (!customer.email && input.customer.email) {
        enrichment.email = input.customer.email;
      }

      if (Object.keys(enrichment).length > 0) {
        customer.update(enrichment);
        await customerRepository.update(customer);
      }
    }

    const payerName = input.customer.name ?? customer?.name;
    const payerEmail = input.customer.email ?? customer?.email;
    const payerDocument = document?.value ?? customer?.document.value;

    // 4. Calculate fees using FeePolicy
    const feeResult = this.feePolicy.calculate({
      amountInCents: input.amount,
      feePercent: store.feePercent,
      feeFixed: store.feeFixed,
    });

    // 5. Generate EMV Pix QR Code
    const txId = this.generateTxId();
    const qrCodeResult = await this.pixQrCodeGenerator.generate({
      pixKey: this.pixKey,
      amountInCents: input.amount,
      merchantName: store.name.substring(0, 25),
      merchantCity: resolvePixMerchantCity(store.city),
      txId,
    });

    // 6. Set expiration time (default: 30 minutes from now)
    const expiresAt = input.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000);

    const pixCharge = PixCharge.create({
      storeId: input.storeId,
      amount: input.amount,
      currency: "BRL",
      pixQrCode: qrCodeResult.qrCodeBase64,
      pixCopyPaste: qrCodeResult.copyPaste,
      pixTxId: qrCodeResult.txId,
      expiresAt,
    });

    await pixChargeRepository.save(pixCharge);

    // 7. Create Payment entity
    const payment = Payment.create({
      storeId: input.storeId,
      customerId: customer?.id,
      pixChargeId: pixCharge.id,
      externalId: input.externalId,
      amount: input.amount,
      fee: feeResult.feeInCents,
      netAmount: feeResult.netAmountInCents,
      description: input.description,
      payerName,
      payerEmail,
      payerDocument,
      environment: input.environment,
      paymentMethod,
      paymentDetails: input.paymentDetails,
      acquirerId: input.acquirerId,
      pixCharge: pixCharge.toObject(),
      items: input.items ?? [],
      expiresAt,
      metadata: input.metadata,
    });

    // 8. Persist Payment
    await paymentRepository.save(payment);
    if (input.items?.length) {
      await paymentRepository.saveItems(payment.id, input.items);
    }

    // 9. Create outbox event for webhook notification
    const outboxEvent = OutboxEvent.create({
      aggregateType: "Payment",
      aggregateId: payment.id,
      eventType: "payment.created",
      requestId: input.requestId,
      storeId: payment.storeId,
      payload: payment.toObject() as unknown as Record<string, unknown>,
    });
    await outboxWriter.save(outboxEvent);

    return {
      payment: payment.toObject(),
      customerCreated,
    };
  }

  async scheduleExpirationAfterCommit(
    input: ICreatePaymentInput,
    output: ICreatePaymentOutput,
  ): Promise<void> {
    // The periodic expiration job is the operational fallback if BullMQ enqueue fails.
    try {
      await this.expirationQueue.scheduleExpiration(
        output.payment.id,
        output.payment.expiresAt,
        input.requestId,
      );
    } catch {
      // Best effort by design: do not fail payment creation after commit.
    }
  }

  /**
   * Generate a unique transaction ID (txId).
   * Format: timestamp + random (max 35 chars for EMV spec)
   */
  private generateTxId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomUUID().split("-")[0];
    return `HP${timestamp}${random}`.substring(0, 35);
  }
}

function shouldCreateCustomer(
  policy: CustomerPromotionPolicy,
  customer: PaymentCustomerInput,
  document?: Document,
): boolean {
  if (!document) return false;

  if (policy === CustomerPromotionPolicy.CHECKOUT_SESSION) {
    return Boolean(customer.name || customer.email);
  }

  return true;
}
