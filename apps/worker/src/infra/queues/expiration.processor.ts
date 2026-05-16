import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import {
  ExpirePaymentUseCase,
  IExpirePaymentInput,
} from '@hockpay/core';
import { createWorkerRequestId } from '../../common/request-id';

/**
 * BullMQ processor for payment expiration jobs.
 *
 * Processes jobs from the 'payment-expiration' queue and
 * calls the ExpirePaymentUseCase to expire payments.
 *
 * This processor replaces the one previously in the API.
 */
@Injectable()
@Processor('payment-expiration')
export class ExpirationProcessor extends WorkerHost {
  private readonly logger = new Logger(ExpirationProcessor.name);

  constructor(private readonly expirePaymentUseCase: ExpirePaymentUseCase) {
    super();
  }

  async process(job: Job<IExpirePaymentInput>): Promise<void> {
    const requestId =
      job.data.requestId ?? createWorkerRequestId('payment-expiration', job.id);
    this.logger.debug(
      `Processing expiration job requestId=${requestId} jobId=${job.id} paymentId=${job.data.paymentId}`,
    );

    await this.expirePaymentUseCase.execute({
      storeId: job.data.storeId,
      paymentId: job.data.paymentId,
      requestId,
    });

    this.logger.debug(`Expiration job requestId=${requestId} jobId=${job.id} completed`);
  }
}
