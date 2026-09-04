import { IPaymentLinkRepository } from '../../domain/repositories/payment-link.repository.interface';
import { IPixChargeRepository } from '../../domain/repositories/pix-charge.repository.interface';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';
import { PixChargeStatus } from '../../domain/entities/pix-charge.entity';
import { PaymentLinkNotFoundError } from '../../domain/errors/payment-link-not-found.error';
export { PaymentLinkCannotBeCancelledError } from '../../domain/errors/payment-link-cannot-be-cancelled.error';
import { PaymentLinkCannotBeCancelledError } from '../../domain/errors/payment-link-cannot-be-cancelled.error';
import { Environment } from '../../domain/value-objects/environment.vo';
import { assertCallerCanMutateEnvironment } from '../services/live-environment-guard';
import { IOutboxWriter } from '../../domain/repositories/outbox-writer.repository.interface';
import { emitPaymentLinkEvent } from '../services/payment-link-event.service';

export interface ICancelPaymentLinkInput {
  storeId: string;
  paymentLinkId: string;
  environment: Environment;
  requestId?: string;
}

export class CancelPaymentLinkUseCase {
  constructor(
    private readonly paymentLinkRepository: IPaymentLinkRepository,
    private readonly pixChargeRepository: IPixChargeRepository,
    private readonly unitOfWork?: IUnitOfWork,
    private readonly outboxWriter?: IOutboxWriter,
  ) {}

  async execute(input: ICancelPaymentLinkInput): Promise<void> {
    if (this.unitOfWork) {
      await this.unitOfWork.execute(async (repos) => {
        await this.cancelWithRepositories(
          input,
          repos.paymentLinkRepository,
          repos.pixChargeRepository,
          repos.outboxWriter,
        );
      });
      return;
    }

    await this.cancelWithRepositories(
      input,
      this.paymentLinkRepository,
      this.pixChargeRepository,
      this.outboxWriter ?? unwiredOutboxWriter(),
    );
  }

  private async cancelWithRepositories(
    input: ICancelPaymentLinkInput,
    paymentLinkRepository: IPaymentLinkRepository,
    pixChargeRepository: IPixChargeRepository,
    outboxWriter: IOutboxWriter,
  ): Promise<void> {
    const link = await this.findLinkForUpdate(
      paymentLinkRepository,
      input.paymentLinkId,
      input.storeId,
    );
    if (!link) throw new PaymentLinkNotFoundError(input.paymentLinkId);

    assertCallerCanMutateEnvironment(link.environment, input.environment);

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

    // Relido depois do update para o payload sair com status CANCELLED,
    // e nao com o status que o link tinha antes da chamada.
    await emitPaymentLinkEvent(
      { paymentLinkRepository, outboxWriter },
      {
        eventType: 'payment_link.cancelled',
        paymentLinkId: input.paymentLinkId,
        storeId: input.storeId,
        requestId: input.requestId,
      },
    );
  }

  private async findLinkForUpdate(repository: IPaymentLinkRepository, id: string, storeId: string) {
    if (typeof repository.findByIdAndStoreIdForUpdate === 'function') {
      return repository.findByIdAndStoreIdForUpdate(id, storeId);
    }
    return repository.findByIdAndStoreId(id, storeId);
  }

  private async findPixChargeForUpdate(
    repository: IPixChargeRepository,
    id: string,
    storeId: string,
  ) {
    if (typeof repository.findByIdAndStoreIdForUpdate === 'function') {
      return repository.findByIdAndStoreIdForUpdate(id, storeId);
    }
    return repository.findByIdAndStoreId(id, storeId);
  }
}

/**
 * Mesmo padrao de `CreatePaymentLinkUseCase`: o caminho sem UnitOfWork existe
 * para wiring legado, e la nao ha transacao onde gravar o outbox. Cancelar sem
 * emitir o evento seria pior do que falhar — o integrador ficaria sem saber que
 * o link morreu. Falha alto, porque isso e erro de configuracao.
 */
function unwiredOutboxWriter(): IOutboxWriter {
  return {
    save: () => {
      throw new Error(
        'CancelPaymentLinkUseCase: emitting payment_link.cancelled requires an IUnitOfWork',
      );
    },
  };
}
