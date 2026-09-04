import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ProcessWebhookUseCase,
  IProcessWebhookInput,
  IOutboxRepository,
  IWebhookLogRepository,
  WebhookJobData,
} from '@hockpay/core';
import { createWorkerRequestId } from '../../common/request-id';
import {
  buildDeadLetterJobData,
  isFinalBullMqFailure,
  WorkerDeadLetterJobData,
} from '../../common/dead-letter-job';

const WEBHOOK_DELIVERY_QUEUE = 'webhook-delivery';
const WEBHOOK_DEAD_LETTER_QUEUE = 'webhook-dead-letter';
const DEFAULT_WEBHOOK_DELIVERY_CONCURRENCY = 5;

/**
 * Quantas entregas correm em paralelo neste worker.
 *
 * Era o default 1 do BullMQ, por omissao e nao por decisao: uma entrega de cada
 * vez em todo o processo. Com o timeout de 30s, um unico destino pendurado
 * segurava a fila inteira. O breaker corta o caso patologico; a concorrencia
 * explicita tira o gargalo do caminho comum.
 */
function webhookDeliveryConcurrency(): number {
  const raw = process.env.WEBHOOK_DELIVERY_CONCURRENCY;
  if (raw === undefined || raw.trim() === '') return DEFAULT_WEBHOOK_DELIVERY_CONCURRENCY;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    new Logger('WebhookProcessor').warn(
      `WEBHOOK_DELIVERY_CONCURRENCY="${raw}" is not a positive integer; falling back to ${DEFAULT_WEBHOOK_DELIVERY_CONCURRENCY}.`,
    );
    return DEFAULT_WEBHOOK_DELIVERY_CONCURRENCY;
  }

  return parsed;
}

/**
 * BullMQ processor for webhook delivery jobs.
 */
@Injectable()
@Processor(WEBHOOK_DELIVERY_QUEUE, { concurrency: webhookDeliveryConcurrency() })
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    private readonly processWebhookUseCase: ProcessWebhookUseCase,
    @Inject('IOutboxRepository')
    private readonly outboxRepository: IOutboxRepository,
    @Inject('IWebhookLogRepository')
    private readonly webhookLogRepository: IWebhookLogRepository,
    @InjectQueue(WEBHOOK_DEAD_LETTER_QUEUE)
    private readonly deadLetterQueue: Queue<WorkerDeadLetterJobData>,
  ) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<void> {
    const requestId = job.data.requestId ?? createWorkerRequestId('webhook-delivery', job.id);
    this.logger.debug(
      `Processing webhook job requestId=${requestId} jobId=${job.id} outboxEventId=${job.data.eventId}`,
    );

    const input: IProcessWebhookInput = {
      eventId: job.data.eventId,
      requestId,
    };

    const result = await this.processWebhookUseCase.execute(input);

    if (!result.delivered) {
      this.logger.warn(
        `Webhook delivery failed requestId=${requestId} jobId=${job.id} outboxEventId=${job.data.eventId} deliveryId=${result.event.id} aggregateType=${result.event.aggregateType} aggregateId=${result.event.aggregateId}: ${result.error}`,
      );

      throw new Error(result.error ?? 'Webhook delivery failed');
    }

    this.logger.debug(
      `Webhook job completed requestId=${requestId} jobId=${job.id} outboxEventId=${job.data.eventId} deliveryId=${result.event.id} aggregateType=${result.event.aggregateType} aggregateId=${result.event.aggregateId}`,
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<WebhookJobData> | undefined, error: Error): Promise<void> {
    if (!job || !isFinalBullMqFailure(job)) {
      return;
    }

    const deadLetterJob = buildDeadLetterJobData(WEBHOOK_DELIVERY_QUEUE, job, error);

    const failedConfigIds = await this.markCanonicalFinalFailure(job, deadLetterJob.failedReason);
    if (failedConfigIds.length > 0) {
      deadLetterJob.configIds = failedConfigIds;
      if (failedConfigIds.length === 1) {
        deadLetterJob.configId = failedConfigIds[0];
      }
    }

    await this.deadLetterQueue.add('dead-letter', deadLetterJob, {
      // BullMQ recusa `:` em jobId customizado (Job.create lanca
      // 'Custom Id cannot contain :'), o que derrubava o worker justamente
      // na falha final -- o caminho que a DLQ existe para proteger.
      jobId: `${WEBHOOK_DELIVERY_QUEUE}-dlq-${job.id}`,
    });

    this.logger.error(
      `Webhook job moved to DLQ requestId=${deadLetterJob.requestId ?? 'unknown'} jobId=${job.id} outboxEventId=${deadLetterJob.outboxEventId ?? 'unknown'} attemptsMade=${job.attemptsMade}: ${deadLetterJob.failedReason}`,
    );
  }

  private async markCanonicalFinalFailure(
    job: Job<WebhookJobData>,
    error: string,
  ): Promise<string[]> {
    const eventId = job.data.eventId;
    const deliveries = await this.webhookLogRepository.findByOutboxEventId(eventId);
    const failedConfigIds = deliveries
      .filter((delivery) => !delivery.isDelivered())
      .map((delivery) => delivery.configId);

    await this.webhookLogRepository.markOutboxDeliveriesFinalFailure(
      eventId,
      error,
      job.attemptsMade,
    );

    const event = await this.outboxRepository.findById(eventId);
    if (!event || event.isProcessed()) {
      return failedConfigIds;
    }

    event.markAsTerminalFailed(error);
    await this.outboxRepository.update(event);
    return failedConfigIds;
  }
}
