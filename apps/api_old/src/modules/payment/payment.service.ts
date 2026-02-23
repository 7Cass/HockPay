import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Payment } from '../../domain/entities';
import { OutboxEvent } from '../../domain/entities/outbox-event.entity';
import { Money, Currency } from '../../domain/value-objects';
import { StoreNotApprovedError, StoreInactiveError } from '../../domain/errors';
import { CreatePaymentDTO, PaymentResponseDTO } from './dto/create-payment.dto';
import { PaymentRepository } from '../../infra/repositories/prisma/payment.repository';
import { StoreRepository } from '../../infra/repositories/prisma/store.repository';
import { CustomerRepository } from '../../infra/repositories/prisma/customer.repository';
import { WebhookRepository } from '../../infra/repositories/prisma/webhook.repository';
import { QrCodePixGeneratorService } from '../../infra/services/pix-generator.service';

/**
 * PaymentService
 *
 * Serviço consolidado que gerencia pagamentos Pix.
 * Substitui os use cases CreatePaymentUseCase, GetPaymentUseCase,
 * ConfirmPaymentUseCase, ExpirePaymentUseCase, FailPaymentUseCase.
 */
@Injectable()
export class PaymentService {
  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly storeRepo: StoreRepository,
    private readonly customerRepo: CustomerRepository,
    private readonly webhookRepo: WebhookRepository,
    private readonly pixGenerator: QrCodePixGeneratorService,
  ) {}

  /**
   * Cria um novo pagamento Pix
   */
  async create(storeId: string, dto: CreatePaymentDTO): Promise<PaymentResponseDTO> {
    // 1. Buscar e validar a store
    const store = await this.storeRepo.findById(storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    if (!store.canProcessPayments()) {
      if (!store.isApproved) {
        throw new StoreNotApprovedError(storeId);
      }
      throw new StoreInactiveError(storeId);
    }

    // 2. Buscar ou criar o customer
    const customer = await this.customerRepo.findOrCreate(storeId, {
      externalId: dto.customer.externalId,
      document: dto.customer.document,
      name: dto.customer.name,
      email: dto.customer.email,
      phone: dto.customer.phone,
    });

    // 3. Validar se já existe pagamento com mesmo externalId (idempotency)
    if (dto.externalId) {
      const existing = await this.paymentRepo.findByExternalId(storeId, dto.externalId);
      if (existing) {
        return this.toResponseDTO(existing);
      }
    }

    // 4. Calcular valores
    const amount = new Money(dto.amount, (dto.currency as Currency) ?? Currency.BRL);
    const { fee, net } = amount.calculateFee(store.feePercent, store.feeFixed);

    // 5. Gerar QR Code Pix
    const paymentId = uuidv4();
    const pixData = await this.pixGenerator.generate({
      amount: dto.amount,
      description: dto.description,
      merchantId: store.merchantId,
      paymentId,
    });

    // 6. Calcular data de expiração (15 minutos a partir de agora)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // 7. Criar o payment
    const payment = Payment.create({
      id: paymentId,
      storeId,
      customerId: customer.id,
      externalId: dto.externalId ?? null,
      amount,
      fee,
      netAmount: net,
      description: dto.description ?? null,
      expiresAt,
      pixQrCode: pixData.qrCode,
      pixCopyPaste: pixData.copyPaste,
      checkoutUrl: this.generateCheckoutUrl(paymentId),
      metadata: dto.metadata ?? null,
    });

    // 8. Salvar o pagamento
    await this.paymentRepo.create(payment);

    // 9. Criar eventos do outbox (payment.created)
    const domainEvents = payment.domainEvents;
    for (const event of domainEvents) {
      const outboxEvent = OutboxEvent.fromDomainEvent(uuidv4(), event);
      await this.webhookRepo.createOutboxEvent(outboxEvent);
    }
    payment.clearDomainEvents();

    return this.toResponseDTO(payment);
  }

  /**
   * Busca um pagamento por ID
   */
  async findById(id: string, requestingStoreId: string): Promise<PaymentResponseDTO | null> {
    const payment = await this.paymentRepo.findById(id);
    if (!payment) {
      return null;
    }

    // Verifica se o pagamento pertence à store que está fazendo a requisição
    if (payment.storeId !== requestingStoreId) {
      throw new ForbiddenException('Access denied to this payment');
    }

    return this.toResponseDTO(payment);
  }

  /**
   * Confirma um pagamento (simulação de Pix recebido)
   * Apenas para ambiente de teste.
   */
  async confirm(paymentId: string, pixTxId?: string): Promise<PaymentResponseDTO> {
    const payment = await this.paymentRepo.findById(paymentId);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    payment.confirm(pixTxId);
    await this.paymentRepo.save(payment);

    // Criar eventos do outbox
    const domainEvents = payment.domainEvents;
    for (const event of domainEvents) {
      const outboxEvent = OutboxEvent.fromDomainEvent(uuidv4(), event);
      await this.webhookRepo.createOutboxEvent(outboxEvent);
    }
    payment.clearDomainEvents();

    return this.toResponseDTO(payment);
  }

  /**
   * Expira um pagamento
   */
  async expire(paymentId: string): Promise<PaymentResponseDTO> {
    const payment = await this.paymentRepo.findById(paymentId);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    payment.expire();
    await this.paymentRepo.save(payment);

    // Criar eventos do outbox
    const domainEvents = payment.domainEvents;
    for (const event of domainEvents) {
      const outboxEvent = OutboxEvent.fromDomainEvent(uuidv4(), event);
      await this.webhookRepo.createOutboxEvent(outboxEvent);
    }
    payment.clearDomainEvents();

    return this.toResponseDTO(payment);
  }

  /**
   * Falha um pagamento (simulação de erro)
   * Apenas para ambiente de teste.
   */
  async fail(paymentId: string, reason: string = 'Payment failed'): Promise<PaymentResponseDTO> {
    const payment = await this.paymentRepo.findById(paymentId);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    payment.fail(reason);
    await this.paymentRepo.save(payment);

    // Criar eventos do outbox
    const domainEvents = payment.domainEvents;
    for (const event of domainEvents) {
      const outboxEvent = OutboxEvent.fromDomainEvent(uuidv4(), event);
      await this.webhookRepo.createOutboxEvent(outboxEvent);
    }
    payment.clearDomainEvents();

    return this.toResponseDTO(payment);
  }

  /**
   * Lista pagamentos de uma store
   */
  async findByStoreId(
    storeId: string,
    options: {
      status?: string;
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<PaymentResponseDTO[]> {
    const payments = await this.paymentRepo.findByStoreId(storeId, {
      ...options,
      status: options.status as any,
    });
    return payments.map(p => this.toResponseDTO(p));
  }

  private toResponseDTO(payment: Payment): PaymentResponseDTO {
    return {
      id: payment.id,
      externalId: payment.externalId,
      amount: payment.amount.amountInCents,
      fee: payment.fee.amountInCents,
      netAmount: payment.netAmount.amountInCents,
      currency: payment.amount.currency,
      description: payment.description,
      status: payment.status,
      pixQrCode: payment.pixQrCode,
      pixCopyPaste: payment.pixCopyPaste,
      checkoutUrl: payment.checkoutUrl,
      expiresAt: payment.expiresAt.toISOString(),
      createdAt: payment.createdAt.toISOString(),
    };
  }

  private generateCheckoutUrl(paymentId: string): string {
    // Em produção, isso seria a URL real do checkout
    return `https://checkout.hockpay.com/pay/${paymentId}`;
  }
}
