import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { Injectable, Logger } from "@nestjs/common";
import {
  ProcessWebhookUseCase,
  IProcessWebhookInput,
  WebhookJobData,
} from "@hockpay/core";
import { createWorkerRequestId } from "../../common/request-id";
import {
  buildDeadLetterJobData,
  isFinalBullMqFailure,
  WorkerDeadLetterJobData,
} from "../../common/dead-letter-job";

const WEBHOOK_DELIVERY_QUEUE = "webhook-delivery";
const WEBHOOK_DEAD_LETTER_QUEUE = "webhook-dead-letter";

/**
 * BullMQ processor for webhook delivery jobs.
 */
@Injectable()
@Processor(WEBHOOK_DELIVERY_QUEUE)
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    private readonly processWebhookUseCase: ProcessWebhookUseCase,
    @InjectQueue(WEBHOOK_DEAD_LETTER_QUEUE)
    private readonly deadLetterQueue: Queue<WorkerDeadLetterJobData>,
  ) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<void> {
    const requestId =
      job.data.requestId ?? createWorkerRequestId("webhook-delivery", job.id);
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
        `Webhook delivery failed requestId=${requestId} jobId=${job.id} outboxEventId=${job.data.eventId} aggregateType=${result.event.aggregateType} aggregateId=${result.event.aggregateId}: ${result.error}`,
      );

      throw new Error(result.error ?? "Webhook delivery failed");
    }

    this.logger.debug(
      `Webhook job completed requestId=${requestId} jobId=${job.id} outboxEventId=${job.data.eventId} aggregateType=${result.event.aggregateType} aggregateId=${result.event.aggregateId}`,
    );
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job<WebhookJobData> | undefined, error: Error): Promise<void> {
    if (!job || !isFinalBullMqFailure(job)) {
      return;
    }

    const deadLetterJob = buildDeadLetterJobData(
      WEBHOOK_DELIVERY_QUEUE,
      job,
      error,
    );

    await this.deadLetterQueue.add("dead-letter", deadLetterJob, {
      jobId: `${WEBHOOK_DELIVERY_QUEUE}:${job.id}`,
    });

    this.logger.error(
      `Webhook job moved to DLQ requestId=${deadLetterJob.requestId ?? "unknown"} jobId=${job.id} outboxEventId=${deadLetterJob.outboxEventId ?? "unknown"} attemptsMade=${job.attemptsMade}: ${deadLetterJob.failedReason}`,
    );
  }
}
