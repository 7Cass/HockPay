import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { AlertJobData, ProcessAlertDeliveryUseCase } from '@hockpay/core';
import {
  buildDeadLetterJobData,
  isFinalBullMqFailure,
  WorkerDeadLetterJobData,
} from '../../common/dead-letter-job';
import { createWorkerRequestId } from '../../common/request-id';

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
    const requestId = job.data.requestId ?? createWorkerRequestId('alert-delivery', job.id);
    this.logger.debug(
      `Processing alert job requestId=${requestId} jobId=${job.id} outboxEventId=${job.data.eventId}`,
    );

    const result = await this.processAlertDeliveryUseCase.execute({
      eventId: job.data.eventId,
      requestId,
    });

    if (result.failed > 0) {
      throw new Error(`Alert delivery failed for ${result.failed} config(s)`);
    }

    this.logger.debug(
      `Alert job completed requestId=${requestId} jobId=${job.id} outboxEventId=${job.data.eventId} delivered=${result.delivered} skipped=${result.skipped}`,
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<AlertJobData> | undefined, error: Error): Promise<void> {
    if (!job || !isFinalBullMqFailure(job)) {
      return;
    }

    const deadLetterJob = buildDeadLetterJobData(ALERT_DELIVERY_QUEUE, job, error);

    await this.deadLetterQueue.add('dead-letter', deadLetterJob, {
      // Mesmo motivo do webhook.processor: `:` e proibido em jobId.
      jobId: `${ALERT_DELIVERY_QUEUE}-dlq-${job.id}`,
    });

    this.logger.error(
      `Alert job moved to DLQ requestId=${job.data.requestId ?? 'unknown'} jobId=${job.id} outboxEventId=${deadLetterJob.outboxEventId ?? 'unknown'} attemptsMade=${job.attemptsMade}: ${deadLetterJob.failedReason}`,
    );
  }
}
