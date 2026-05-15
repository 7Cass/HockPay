import {
  PaymentLink,
  PaymentLinkListItem,
} from "../../domain/entities/payment-link.entity";
import { PixCharge } from "../../domain/entities/pix-charge.entity";
import { IPaymentLinkRepository } from "../../domain/repositories/payment-link.repository.interface";
import { IPixChargeRepository } from "../../domain/repositories/pix-charge.repository.interface";
import { IStoreRepository } from "../../domain/repositories/store.repository.interface";
import { ITokenGeneratorPort } from "../ports/token-generator.port";
import { IPixQrCodeGeneratorPort } from "../ports/pix-qr-code-generator.port";
import { StoreNotFoundError } from "../../domain/errors/store-not-found.error";
import { StoreInactiveError } from "../../domain/errors/store-inactive.error";
import { StoreNotApprovedError } from "../../domain/errors/store-not-approved.error";

export interface ICreatePaymentLinkInput {
  storeId: string;
  amount: number;
  title?: string;
  description?: string;
  internalReference?: string;
  expiresAt?: Date;
}

export interface ICreatePaymentLinkOutput {
  paymentLink: PaymentLinkListItem;
}

export class PaymentLinkInvalidExpirationError extends Error {
  readonly code = "PAYMENT_LINK_INVALID_EXPIRATION";

  constructor() {
    super("Payment link expiration must be a future date");
  }
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
  ) {}

  async execute(input: ICreatePaymentLinkInput): Promise<ICreatePaymentLinkOutput> {
    const store = await this.storeRepository.findById(input.storeId);
    if (!store) throw new StoreNotFoundError(input.storeId);
    if (!store.isActive) throw new StoreInactiveError(store.id);
    if (!store.isApproved) throw new StoreNotApprovedError(store.id);

    const publicToken = this.tokenGenerator.generateBase64(32);
    const linkId = crypto.randomUUID();

    const txId = this.generateTxId();
    const expiresAt = this.validateExpiresAt(input.expiresAt);
    const qrCodeResult = await this.pixQrCodeGenerator.generate({
      pixKey: this.pixKey,
      amountInCents: input.amount,
      merchantName: store.name.substring(0, 25),
      merchantCity: "SAO PAULO",
      txId,
    });
    const pixCharge = PixCharge.create({
      storeId: input.storeId,
      amount: input.amount,
      currency: "BRL",
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
      amount: input.amount,
      title: input.title,
      description: input.description,
      internalReference: input.internalReference,
      expiresAt,
    });

    await this.pixChargeRepository.save(pixCharge);
    await this.paymentLinkRepository.save(link);

    return {
      paymentLink: {
        ...link.toObject(),
        checkoutUrl: `${this.checkoutBaseUrl}/pay/${publicToken}`,
        status: "ACTIVE",
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
    const random = crypto.randomUUID().split("-")[0];
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
