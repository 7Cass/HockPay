import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AlertJobData, ProcessAlertDeliveryUseCase } from '@hockpay/core';

@Injectable()
@Processor('alert-delivery')
export class AlertProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertProcessor.name);

  constructor(private readonly processAlertDeliveryUseCase: ProcessAlertDeliveryUseCase) {
    super();
  }

  async process(job: Job<AlertJobData>): Promise<void> {
    this.logger.debug(`Processing alert job ${job.id} for event ${job.data.eventId}`);

    const result = await this.processAlertDeliveryUseCase.execute({
      eventId: job.data.eventId,
    });

    if (result.failed > 0) {
      throw new Error(`Alert delivery failed for ${result.failed} config(s)`);
    }

    this.logger.debug(
      `Alert job ${job.id} completed: ${result.delivered} delivered, ${result.skipped} skipped`,
    );
  }
}
