import { PaymentLink, PaymentLinkListItem } from '../../domain/entities/payment-link.entity';
import { CreateLineItemInput } from '../../domain/entities/line-item.entity';
import { PixCharge } from '../../domain/entities/pix-charge.entity';
import { Environment } from '../../domain/value-objects/environment.vo';
import { IPaymentLinkRepository } from '../../domain/repositories/payment-link.repository.interface';
import { IPixChargeRepository } from '../../domain/repositories/pix-charge.repository.interface';
import { IStoreRepository } from '../../domain/repositories/store.repository.interface';
import { IProductRepository } from '../../domain/repositories/product.repository.interface';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';
import { ITokenGeneratorPort } from '../ports/token-generator.port';
import { IPixQrCodeGeneratorPort } from '../ports/pix-qr-code-generator.port';
import { StoreNotFoundError } from '../../domain/errors/store-not-found.error';
import { StoreInactiveError } from '../../domain/errors/store-inactive.error';
import { StoreNotApprovedError } from '../../domain/errors/store-not-approved.error';
export { PaymentLinkInvalidExpirationError } from '../../domain/errors/payment-link-invalid-expiration.error';
import { PaymentLinkInvalidExpirationError } from '../../domain/errors/payment-link-invalid-expiration.error';
import { resolvePixMerchantCity } from '../services/pix-merchant-city';
import { LineItemResolverService } from '../services/line-item-resolver.service';
import { IOutboxWriter } from '../../domain/repositories/outbox-writer.repository.interface';
import { buildPaymentLinkOutboxEvent } from '../services/payment-link-event.service';

export interface ICreatePaymentLinkInput {
  storeId: string;
  requestId?: string;
  environment?: Environment;
  amount?: number;
  items?: CreateLineItemInput[];
  title?: string;
  description?: string;
  internalReference?: string;
  expiresAt?: Date;
}

export interface ICreatePaymentLinkOutput {
  paymentLink: PaymentLinkListItem;
}

export class CreatePaymentLinkUseCase {
  constructor(
    private readonly paymentLinkRepository: IPaymentLinkRepository,
    private readonly pixChargeRepository: IPixChargeRepository,
    private readonly storeRepository: IStoreRepository,
    private readonly tokenGenerator: ITokenGeneratorPort,
    private readonly pixQrCodeGenerator: IPixQrCodeGeneratorPort,
    private readonly checkoutBaseUrl: string,
    private readonly pixKey: string,
    private readonly unitOfWork?: IUnitOfWork,
    private readonly productRepository?: IProductRepository,
    private readonly outboxWriter?: IOutboxWriter,
  ) {}

  async execute(input: ICreatePaymentLinkInput): Promise<ICreatePaymentLinkOutput> {
    if (this.unitOfWork) {
      return this.unitOfWork.execute((repos) => this.executeInTransaction(input, repos));
    }

    return this.executeInTransaction(input, {
      storeRepository: this.storeRepository,
      pixChargeRepository: this.pixChargeRepository,
      paymentLinkRepository: this.paymentLinkRepository,
      productRepository: this.productRepository ?? unwiredProductRepository(),
      outboxWriter: this.outboxWriter ?? unwiredOutboxWriter(),
    });
  }

  async executeInTransaction(
    input: ICreatePaymentLinkInput,
    repos: Pick<
      import('../../domain/repositories/unit-of-work.interface').ITransactedRepositories,
      | 'storeRepository'
      | 'pixChargeRepository'
      | 'paymentLinkRepository'
      | 'productRepository'
      | 'outboxWriter'
    >,
  ): Promise<ICreatePaymentLinkOutput> {
    const store = await repos.storeRepository.findById(input.storeId);
    if (!store) throw new StoreNotFoundError(input.storeId);
    if (!store.isActive) throw new StoreInactiveError(store.id);
    if (!store.isApproved) throw new StoreNotApprovedError(store.id);

    const publicToken = this.tokenGenerator.generateBase64(32);
    const linkId = crypto.randomUUID();
    const environment = input.environment ?? Environment.TEST;

    // Mesmo contrato de checkout sessions: exatamente um de amount ou items.
    // O resolver valida produto, ambiente e disponibilidade, e devolve o
    // snapshot que sera congelado junto com a PixCharge.
    const resolver = new LineItemResolverService(repos.productRepository);
    const { amount, items } = await resolver.resolve({
      storeId: input.storeId,
      environment,
      amount: input.amount,
      items: input.items,
    });

    const txId = this.generateTxId();
    const expiresAt = this.validateExpiresAt(input.expiresAt);
    const qrCodeResult = await this.pixQrCodeGenerator.generate({
      pixKey: this.pixKey,
      amountInCents: amount,
      merchantName: store.name.substring(0, 25),
      merchantCity: resolvePixMerchantCity(store.city),
      txId,
    });
    const pixCharge = PixCharge.create({
      storeId: input.storeId,
      amount,
      currency: 'BRL',
      pixQrCode: qrCodeResult.qrCodeBase64,
      pixCopyPaste: qrCodeResult.copyPaste,
      pixTxId: qrCodeResult.txId,
      expiresAt,
    });

    const link = PaymentLink.create({
      id: linkId,
      storeId: input.storeId,
      pixChargeId: pixCharge.id,
      publicToken,
      amount,
      environment,
      title: input.title,
      description: input.description,
      internalReference: input.internalReference,
      items,
      expiresAt,
    });

    await repos.pixChargeRepository.save(pixCharge);
    await repos.paymentLinkRepository.save(link);

    const paymentLink: PaymentLinkListItem = {
      ...link.toObject(),
      checkoutUrl: `${this.checkoutBaseUrl}/pay/${publicToken}`,
      status: 'ACTIVE',
      paymentId: null,
      paymentStatus: null,
      pixCharge: pixCharge.toObject(),
      failedPaymentCount: 0,
      lastPaymentId: null,
      lastPaymentStatus: null,
      lastFailedAt: null,
    };

    // Links tambem nascem pelo dashboard, entao um backend que so fala com a
    // API descobriria a existencia deles apenas quando alguem pagasse. Emitido
    // a partir do objeto que acabou de ser montado, sem reler o banco.
    await repos.outboxWriter.save(
      buildPaymentLinkOutboxEvent({
        eventType: 'payment_link.created',
        link: paymentLink,
        requestId: input.requestId,
      }),
    );

    return { paymentLink };
  }

  private generateTxId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomUUID().split('-')[0];
    return `HPL${timestamp}${random}`.substring(0, 35);
  }

  private validateExpiresAt(expiresAt?: Date): Date | undefined {
    if (!expiresAt) return undefined;
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      throw new PaymentLinkInvalidExpirationError();
    }
    return expiresAt;
  }
}

/**
 * O caminho sem UnitOfWork existe para wiring legado/tests. Se alguem chamar
 * com `items` por esse caminho sem ter injetado um IProductRepository, isso e
 * erro de configuracao e nao de entrada do usuario -- falha alto em vez de
 * criar um link com itens vazios.
 */
function unwiredProductRepository(): IProductRepository {
  const fail = (): never => {
    throw new Error(
      'CreatePaymentLinkUseCase: items require a productRepository (inject IUnitOfWork or IProductRepository)',
    );
  };
  return new Proxy({} as IProductRepository, { get: () => fail });
}

/**
 * Mesma razao do `unwiredProductRepository`: sem UnitOfWork nao ha transacao
 * onde gravar o outbox, e criar um link sem anunciar sua criacao deixaria o
 * catalogo de eventos mentindo. Erro de configuracao, nao de entrada.
 */
function unwiredOutboxWriter(): IOutboxWriter {
  return {
    save: () => {
      throw new Error(
        'CreatePaymentLinkUseCase: emitting payment_link.created requires an IUnitOfWork',
      );
    },
  };
}
