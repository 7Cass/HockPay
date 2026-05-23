import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { AlertJobData, ProcessAlertDeliveryUseCase } from '@hockpay/core';
import {
  buildDeadLetterJobData,
  isFinalBullMqFailure,
  WorkerDeadLetterJobData,
} from '../../common/dead-letter-job';

const ALERT_DELIVERY_QUEUE = 'alert-delivery';
const ALERT_DEAD_LETTER_QUEUE = 'alert-dead-letter';

@Injectable()
@Processor(ALERT_DELIVERY_QUEUE)
export class AlertProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertProcessor.name);

  constructor(
    private readonly processAlertDeliveryUseCase: ProcessAlertDeliveryUseCase,
    @InjectQueue(ALERT_DEAD_LETTER_QUEUE)
    private readonly deadLetterQueue: Queue<WorkerDeadLetterJobData>,
  ) {
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

  @OnWorkerEvent('failed')
  async onFailed(job: Job<AlertJobData> | undefined, error: Error): Promise<void> {
    if (!job || !isFinalBullMqFailure(job)) {
      return;
    }

    const deadLetterJob = buildDeadLetterJobData(ALERT_DELIVERY_QUEUE, job, error);

    await this.deadLetterQueue.add('dead-letter', deadLetterJob, {
      jobId: `${ALERT_DELIVERY_QUEUE}:${job.id}`,
    });

    this.logger.error(
      `Alert job moved to DLQ jobId=${job.id} outboxEventId=${deadLetterJob.outboxEventId ?? 'unknown'} attemptsMade=${job.attemptsMade}: ${deadLetterJob.failedReason}`,
    );
  }
}
