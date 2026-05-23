import { IPaymentLinkRepository } from "../../domain/repositories/payment-link.repository.interface";
import { IPixChargeRepository } from "../../domain/repositories/pix-charge.repository.interface";
import { IUnitOfWork } from "../../domain/repositories/unit-of-work.interface";
import { PixChargeStatus } from "../../domain/entities/pix-charge.entity";
import { PaymentLinkNotFoundError } from "./get-payment-link.use-case";

export class PaymentLinkCannotBeCancelledError extends Error {
  readonly code = "PAYMENT_LINK_CANNOT_BE_CANCELLED";

  constructor() {
    super("Payment link cannot be cancelled after payment is paid");
  }
}

export class CancelPaymentLinkUseCase {
  constructor(
    private readonly paymentLinkRepository: IPaymentLinkRepository,
    private readonly pixChargeRepository: IPixChargeRepository,
    private readonly unitOfWork?: IUnitOfWork,
  ) {}

  async execute(input: {
    storeId: string;
    paymentLinkId: string;
    requestId?: string;
  }): Promise<void> {
    if (this.unitOfWork) {
      await this.unitOfWork.execute(async (repos) => {
        await this.cancelWithRepositories(
          input,
          repos.paymentLinkRepository,
          repos.pixChargeRepository,
        );
      });
      return;
    }

    await this.cancelWithRepositories(
      input,
      this.paymentLinkRepository,
      this.pixChargeRepository,
    );
  }

  private async cancelWithRepositories(
    input: {
      storeId: string;
      paymentLinkId: string;
      requestId?: string;
    },
    paymentLinkRepository: IPaymentLinkRepository,
    pixChargeRepository: IPixChargeRepository,
  ): Promise<void> {
    const link = await this.findLinkForUpdate(
      paymentLinkRepository,
      input.paymentLinkId,
      input.storeId,
    );
    if (!link) throw new PaymentLinkNotFoundError(input.paymentLinkId);

    const charge = await this.findPixChargeForUpdate(
      pixChargeRepository,
      link.pixChargeId,
      input.storeId,
    );

    if (charge?.status === PixChargeStatus.PAID) {
      throw new PaymentLinkCannotBeCancelledError();
    }

    link.cancel();
    await paymentLinkRepository.update(link);

    if (charge?.isOpen()) {
      charge.cancel();
      await pixChargeRepository.update(charge);
    }
  }

  private async findLinkForUpdate(
    repository: IPaymentLinkRepository,
    id: string,
    storeId: string,
  ) {
    if (typeof repository.findByIdAndStoreIdForUpdate === "function") {
      return repository.findByIdAndStoreIdForUpdate(id, storeId);
    }
    return repository.findByIdAndStoreId(id, storeId);
  }

  private async findPixChargeForUpdate(
    repository: IPixChargeRepository,
    id: string,
    storeId: string,
  ) {
    if (typeof repository.findByIdAndStoreIdForUpdate === "function") {
      return repository.findByIdAndStoreIdForUpdate(id, storeId);
    }
    return repository.findByIdAndStoreId(id, storeId);
  }
}
