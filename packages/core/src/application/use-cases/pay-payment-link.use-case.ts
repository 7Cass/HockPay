import { Payment, PaymentMethod, PaymentObject } from '../../domain/entities/payment.entity';
import { OutboxEvent } from '../../domain/entities/outbox-event.entity';
import { PaymentLinkListItem, PaymentLinkStatus } from '../../domain/entities/payment-link.entity';
import { PixChargeObject, PixChargeStatus } from '../../domain/entities/pix-charge.entity';
import { Environment } from '../../domain/value-objects/environment.vo';
import {
  ITransactedRepositories,
  IUnitOfWork,
} from '../../domain/repositories/unit-of-work.interface';
import { IPaymentLinkRepository } from '../../domain/repositories/payment-link.repository.interface';
import { LiveEnvironmentNotAllowedError } from '../../domain/errors/live-environment-not-allowed.error';
import { FeePolicy } from '../services/fee-policy.service';
import { enrichPaymentAttempt } from '../services/payment-attempt-context.service';
import { settleConfirmedPayment } from './settle-confirmed-payment';
import { PaymentLinkNotFoundError } from '../../domain/errors/payment-link-not-found.error';
import { PaymentLinkUnavailableError } from '../../domain/errors/payment-link-unavailable.error';
import { CustomerDocumentRequiredError } from '../../domain/errors/customer-document-required.error';
import { Customer } from '../../domain/entities/customer.entity';
import { Document } from '../../domain/value-objects/document.vo';
import { PaymentCustomerInput } from './create-payment.use-case';
import { forkLineItemSnapshot } from '../../domain/entities/line-item.entity';

export interface IPayPaymentLinkInput {
  publicToken: string;
  requestId?: string;
  environment: Environment;
  customer?: PaymentCustomerInput;
}

export interface IPayPaymentLinkOutput {
  payment: PaymentObject;
}

export class PayPaymentLinkUseCase {
  constructor(
    private readonly paymentLinkRepository: IPaymentLinkRepository,
    private readonly unitOfWork: IUnitOfWork,
    private readonly feePolicy: FeePolicy,
  ) {}

  async execute(input: IPayPaymentLinkInput): Promise<IPayPaymentLinkOutput> {
    return this.unitOfWork.execute(async (repos) => {
      const item = await repos.paymentLinkRepository.findPublicByTokenForUpdate(input.publicToken);
      if (!item) throw new PaymentLinkNotFoundError(input.publicToken);

      this.ensureSimulationAllowed(input.environment, item.environment);

      const pixCharge = await repos.pixChargeRepository.findByIdAndStoreIdForUpdate(
        item.pixCharge.id,
        item.storeId,
      );
      if (!pixCharge) {
        throw new PaymentLinkUnavailableError('Payment link Pix charge is invalid');
      }

      if (
        this.isAlreadyPaid(item.status, pixCharge.status) ||
        pixCharge.status === PixChargeStatus.PAID
      ) {
        const paidPayment = await this.findPaidPayment(repos, item.storeId, pixCharge.id);
        if (paidPayment) {
          return {
            payment: await this.buildPaymentPayload(repos, paidPayment, pixCharge.toObject()),
          };
        }
      }

      this.ensurePayable(item.status, item.pixCharge.status);

      if (pixCharge.hasExpired()) {
        pixCharge.expire();
        await repos.pixChargeRepository.update(pixCharge);
        throw new PaymentLinkUnavailableError('Payment link has expired');
      }
      if (!pixCharge.isOpen()) {
        throw new PaymentLinkUnavailableError('Payment link is not payable');
      }

      const store = await repos.storeRepository.findById(item.storeId);
      if (!store) throw new PaymentLinkUnavailableError('Payment link store is invalid');

      const customer = await this.resolveCustomer(repos, item.storeId, input.customer);

      const payment = this.createAttempt(input, item, pixCharge.toObject(), store, customer);

      await repos.paymentRepository.save(payment);
      // Os itens sao uma tabela propria: save() nao os persiste (mesmo
      // contrato usado em CreatePaymentUseCase).
      if (payment.items.length > 0) {
        await repos.paymentRepository.saveItems(payment.id, payment.items);
      }
      const createdPayload = await this.buildPaymentPayload(repos, payment, pixCharge.toObject());

      const createdOutboxEvent = OutboxEvent.create({
        aggregateType: 'Payment',
        aggregateId: payment.id,
        eventType: 'payment.created',
        requestId: input.requestId,
        storeId: payment.storeId,
        payload: createdPayload as unknown as Record<string, unknown>,
      });
      await repos.outboxWriter.save(createdOutboxEvent);

      payment.confirm();

      const confirmedPayload = await settleConfirmedPayment(repos, {
        payment,
        pixCharge,
        storeId: item.storeId,
        requestId: input.requestId,
      });

      return {
        payment: confirmedPayload,
      };
    });
  }

  private async resolveCustomer(
    repos: ITransactedRepositories,
    storeId: string,
    customerInput?: PaymentCustomerInput,
  ): Promise<Customer> {
    if (!customerInput?.document) {
      throw new CustomerDocumentRequiredError();
    }
    const document = new Document(customerInput.document);

    const existing = await repos.customerRepository.findByDocument(storeId, document.value);
    if (existing) {
      return existing;
    }

    const customer = Customer.create({
      storeId,
      name: customerInput.name,
      email: customerInput.email,
      document,
    });
    await repos.customerRepository.save(customer);
    return customer;
  }

  private createAttempt(
    input: IPayPaymentLinkInput,
    item: PaymentLinkListItem,
    pixCharge: PixChargeObject,
    store: { feePercent: number; feeFixed: number },
    customer: Customer,
  ): Payment {
    const feeResult = this.feePolicy.calculate({
      amountInCents: item.amount,
      feePercent: store.feePercent,
      feeFixed: store.feeFixed,
    });
    const paymentExpiresAt = pixCharge.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000);

    return Payment.create({
      storeId: item.storeId,
      customerId: customer.id,
      payerName: customer.name,
      payerEmail: customer.email,
      payerDocument: customer.document.value,
      pixChargeId: pixCharge.id,
      amount: item.amount,
      fee: feeResult.feeInCents,
      netAmount: feeResult.netAmountInCents,
      currency: item.currency,
      description: item.description ?? item.title ?? undefined,
      environment: item.environment ?? input.environment,
      paymentMethod: PaymentMethod.PIX,
      pixCharge,
      // Snapshot ja congelado na criacao do link: a tentativa copia os itens
      // como estavam, nao como o produto esta hoje, e com identidade propria
      // para nao colidir com as outras tentativas do mesmo link.
      items: item.items.map(forkLineItemSnapshot),
      expiresAt: paymentExpiresAt,
      metadata: {
        origin: 'payment_link',
        paymentLinkId: item.id,
        internalReference: item.internalReference ?? undefined,
      },
    });
  }

  private async buildPaymentPayload(
    repos: ITransactedRepositories,
    payment: Payment,
    pixCharge: PixChargeObject,
  ): Promise<PaymentObject> {
    const relatedAttempts = payment.pixChargeId
      ? await repos.paymentRepository.findByPixChargeIdAndStoreId(
          payment.pixChargeId,
          payment.storeId,
        )
      : [payment];
    const currentPayment = {
      ...payment.toObject(),
      pixCharge,
    };

    return enrichPaymentAttempt(
      currentPayment,
      relatedAttempts.map((attempt) =>
        attempt.id === payment.id ? currentPayment : attempt.toObject(),
      ),
    );
  }

  private ensureSimulationAllowed(
    requestEnvironment: Environment,
    linkEnvironment: Environment,
  ): void {
    if (requestEnvironment === Environment.LIVE || linkEnvironment === Environment.LIVE) {
      throw new LiveEnvironmentNotAllowedError();
    }
  }

  private isAlreadyPaid(linkStatus: PaymentLinkStatus, pixChargeStatus: PixChargeStatus): boolean {
    return linkStatus === 'PAID' || pixChargeStatus === PixChargeStatus.PAID;
  }

  private async findPaidPayment(
    repos: ITransactedRepositories,
    storeId: string,
    pixChargeId: string,
  ): Promise<Payment | null> {
    const attempts = await repos.paymentRepository.findByPixChargeIdAndStoreId(
      pixChargeId,
      storeId,
    );
    return attempts.find((attempt) => attempt.isConfirmed() || attempt.isReleased()) ?? null;
  }

  private ensurePayable(linkStatus: PaymentLinkStatus, pixChargeStatus: PixChargeStatus): void {
    if (
      (linkStatus !== 'ACTIVE' && linkStatus !== 'OPENED') ||
      pixChargeStatus !== PixChargeStatus.OPEN
    ) {
      throw new PaymentLinkUnavailableError('Payment link is not payable');
    }
  }
}
