import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import {
  ProcessWebhookUseCase,
  IProcessWebhookInput,
  WebhookJobData,
} from '@hockpay/core';

/**
 * BullMQ processor for webhook delivery jobs.
 */
@Injectable()
@Processor('webhook-delivery')
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(private readonly processWebhookUseCase: ProcessWebhookUseCase) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<void> {
    this.logger.debug(`Processing webhook job ${job.id} for event ${job.data.eventId}`);

    const input: IProcessWebhookInput = {
      eventId: job.data.eventId,
    };

    const result = await this.processWebhookUseCase.execute(input);

    if (!result.delivered) {
      this.logger.warn(
        `Webhook delivery failed for event ${job.data.eventId}: ${result.error}`,
      );

      // If the event can retry, throw to trigger BullMQ retry
      if (result.event.status === 'PENDING') {
        throw new Error(result.error ?? 'Webhook delivery failed');
      }
    }

    this.logger.debug(`Webhook job ${job.id} completed`);
  }
}
