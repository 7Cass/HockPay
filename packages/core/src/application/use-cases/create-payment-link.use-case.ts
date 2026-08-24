import { PaymentLink, PaymentLinkListItem } from '../../domain/entities/payment-link.entity';
import { PixCharge } from '../../domain/entities/pix-charge.entity';
import { Environment } from '../../domain/value-objects/environment.vo';
import { IPaymentLinkRepository } from '../../domain/repositories/payment-link.repository.interface';
import { IPixChargeRepository } from '../../domain/repositories/pix-charge.repository.interface';
import { IStoreRepository } from '../../domain/repositories/store.repository.interface';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';
import { ITokenGeneratorPort } from '../ports/token-generator.port';
import { IPixQrCodeGeneratorPort } from '../ports/pix-qr-code-generator.port';
import { StoreNotFoundError } from '../../domain/errors/store-not-found.error';
import { StoreInactiveError } from '../../domain/errors/store-inactive.error';
import { StoreNotApprovedError } from '../../domain/errors/store-not-approved.error';
import { InvalidLineItemsError } from '../../domain/errors/invalid-line-items.error';
export { PaymentLinkInvalidExpirationError } from '../../domain/errors/payment-link-invalid-expiration.error';
import { PaymentLinkInvalidExpirationError } from '../../domain/errors/payment-link-invalid-expiration.error';
import { resolvePixMerchantCity } from '../services/pix-merchant-city';

export interface ICreatePaymentLinkInput {
  storeId: string;
  environment?: Environment;
  amount?: number;
  items?: unknown[];
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
  ) {}

  async execute(input: ICreatePaymentLinkInput): Promise<ICreatePaymentLinkOutput> {
    if (this.unitOfWork) {
      return this.unitOfWork.execute((repos) => this.executeInTransaction(input, repos));
    }

    return this.executeInTransaction(input, {
      storeRepository: this.storeRepository,
      pixChargeRepository: this.pixChargeRepository,
      paymentLinkRepository: this.paymentLinkRepository,
    });
  }

  async executeInTransaction(
    input: ICreatePaymentLinkInput,
    repos: Pick<
      import('../../domain/repositories/unit-of-work.interface').ITransactedRepositories,
      'storeRepository' | 'pixChargeRepository' | 'paymentLinkRepository'
    >,
  ): Promise<ICreatePaymentLinkOutput> {
    const store = await repos.storeRepository.findById(input.storeId);
    if (!store) throw new StoreNotFoundError(input.storeId);
    if (!store.isActive) throw new StoreInactiveError(store.id);
    if (!store.isApproved) throw new StoreNotApprovedError(store.id);

    const publicToken = this.tokenGenerator.generateBase64(32);
    const linkId = crypto.randomUUID();
    const environment = input.environment ?? Environment.TEST;
    const amount = this.validateAmount(input);

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
      expiresAt,
    });

    await repos.pixChargeRepository.save(pixCharge);
    await repos.paymentLinkRepository.save(link);

    return {
      paymentLink: {
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
      },
    };
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

  private validateAmount(input: ICreatePaymentLinkInput): number {
    if (input.items !== undefined) {
      throw new InvalidLineItemsError('Payment links do not support items; provide amount');
    }
    if (!Number.isInteger(input.amount) || (input.amount ?? 0) < 1) {
      throw new InvalidLineItemsError('Amount must be at least 1 cent');
    }
    if ((input.amount ?? 0) > 9999999999) {
      throw new InvalidLineItemsError('Amount cannot exceed 99,999,999.99 BRL');
    }
    return input.amount!;
  }
}
