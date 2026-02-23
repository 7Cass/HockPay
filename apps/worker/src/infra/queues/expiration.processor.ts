import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import {
  ExpirePaymentUseCase,
  IExpirePaymentInput,
} from '@hockpay/core';

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
    this.logger.debug(`Processing expiration job ${job.id} for payment ${job.data.paymentId}`);

    await this.expirePaymentUseCase.execute({
      paymentId: job.data.paymentId,
    });

    this.logger.debug(`Expiration job ${job.id} completed`);
  }
}
