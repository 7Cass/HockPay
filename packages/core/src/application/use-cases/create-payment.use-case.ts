import {
  Payment,
  PaymentObject,
  PaymentMethod,
} from "../../domain/entities/payment.entity";
import { OutboxEvent } from "../../domain/entities/outbox-event.entity";
import { Document } from "../../domain/value-objects/document.vo";
import { Environment } from "../../domain/value-objects/environment.vo";
import { IPaymentRepository } from "../../domain/repositories/payment.repository.interface";
import { ICustomerRepository } from "../../domain/repositories/customer.repository.interface";
import { IStoreRepository } from "../../domain/repositories/store.repository.interface";
import { IOutboxWriter } from "../../domain/repositories/outbox-writer.repository.interface";
import { IPixQrCodeGeneratorPort } from "../ports/pix-qr-code-generator.port";
import { IExpirationQueuePort } from "../ports/expiration-queue.port";
import { ITokenGeneratorPort } from "../ports/token-generator.port";
import { FeePolicy } from "../services/fee-policy.service";
import { StoreNotFoundError } from "../../domain/errors/store-not-found.error";
import { StoreInactiveError } from "../../domain/errors/store-inactive.error";
import { StoreNotApprovedError } from "../../domain/errors/store-not-approved.error";
import { ExternalIdAlreadyExistsError } from "../../domain/errors/external-id-already-exists.error";
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
  DIRECT_PAYMENT_API = 'DIRECT_PAYMENT_API',
  CHECKOUT_SESSION = 'CHECKOUT_SESSION',
}

/**
 * Input DTO for CreatePaymentUseCase.
 */
export interface ICreatePaymentInput {
  storeId: string;
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
    private readonly paymentRepository: IPaymentRepository,
    private readonly customerRepository: ICustomerRepository,
    private readonly storeRepository: IStoreRepository,
    private readonly outboxWriter: IOutboxWriter,
    private readonly pixQrCodeGenerator: IPixQrCodeGeneratorPort,
    private readonly expirationQueue: IExpirationQueuePort,
    private readonly feePolicy: FeePolicy,
    private readonly pixKey: string, // Store's Pix key for receiving payments
  ) {}

  async execute(input: ICreatePaymentInput): Promise<ICreatePaymentOutput> {
    // 1. Validate store exists, is active, and approved
    const store = await this.storeRepository.findById(input.storeId);

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
      const externalIdExists = await this.paymentRepository.externalIdExists(
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
      ? await this.customerRepository.findByExternalId(input.storeId, externalId)
      : null;
    const customerByDocument = document
      ? await this.customerRepository.findByDocument(
          input.storeId,
          document.value,
        )
      : null;

    if (
      customerByExternalId &&
      customerByDocument &&
      customerByExternalId.id !== customerByDocument.id
    ) {
      throw new CustomerIdentityConflictError(
        'Provided externalId and document refer to different customers',
      );
    }

    if (
      customerByExternalId &&
      document &&
      !customerByExternalId.document.equals(document)
    ) {
      throw new CustomerIdentityConflictError(
        'Provided document does not match the customer linked to this externalId',
      );
    }

    if (
      customerByDocument &&
      externalId &&
      customerByDocument.externalId &&
      customerByDocument.externalId !== externalId
    ) {
      throw new CustomerIdentityConflictError(
        'Provided externalId does not match the customer linked to this document',
      );
    }

    let customer = customerByExternalId ?? customerByDocument;
    let customerCreated = false;
    const customerPromotionPolicy =
      input.customerPromotionPolicy ?? CustomerPromotionPolicy.DIRECT_PAYMENT_API;

    if (!customer && shouldCreateCustomer(customerPromotionPolicy, input.customer, document)) {
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
      await this.customerRepository.save(customer);
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
        await this.customerRepository.update(customer);
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
      merchantCity: "SAO PAULO", // Default city, can be configurable
      txId,
    });

    // 6. Set expiration time (default: 30 minutes from now)
    const expiresAt = input.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000);

    // 7. Create Payment entity
    const payment = Payment.create({
      storeId: input.storeId,
      customerId: customer?.id,
      externalId: input.externalId,
      amount: input.amount,
      fee: feeResult.feeInCents,
      netAmount: feeResult.netAmountInCents,
      description: input.description,
      payerName,
      payerEmail,
      payerDocument,
      environment: input.environment,
      paymentMethod: input.paymentMethod ?? PaymentMethod.PIX,
      paymentDetails: input.paymentDetails,
      acquirerId: input.acquirerId,
      pixQrCode: qrCodeResult.qrCodeBase64,
      pixCopyPaste: qrCodeResult.copyPaste,
      pixTxId: qrCodeResult.txId,
      expiresAt,
      metadata: input.metadata,
    });

    // 8. Persist Payment
    await this.paymentRepository.save(payment);

    // 10. Create outbox event for webhook notification
    const outboxEvent = OutboxEvent.create({
      aggregateType: "Payment",
      aggregateId: payment.id,
      eventType: "payment.created",
      payload: payment.toObject() as unknown as Record<string, unknown>,
    });
    await this.outboxWriter.save(outboxEvent);

    // 10. Schedule expiration job
    await this.expirationQueue.scheduleExpiration(payment.id, expiresAt);

    // 11. Return output
    return {
      payment: payment.toObject(),
      customerCreated,
    };
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
