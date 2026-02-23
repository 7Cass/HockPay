import { IWebhookLogRepository } from '../../domain/repositories/webhook-log.repository.interface';
import { IOutboxRepository } from '../../domain/repositories/outbox.repository.interface';

/**
 * Input DTO for CleanupLogsUseCase.
 */
export interface ICleanupLogsInput {
  webhookLogRetentionDays?: number;
  outboxRetentionDays?: number;
}

/**
 * Output DTO for CleanupLogsUseCase.
 */
export interface ICleanupLogsOutput {
  deletedWebhookLogs: number;
  deletedOutboxEvents: number;
}

/**
 * Use Case: Cleanup Logs
 *
 * This use case handles cleaning up old logs and processed events.
 * Called by:
 * - Cleanup job (cron daily at 3am)
 *
 * Business rules:
 * - Delete webhook logs older than retention period
 * - Delete processed outbox events older than retention period
 * - Default retention: 30 days
 */
export class CleanupLogsUseCase {
  constructor(
    private readonly webhookLogRepository: IWebhookLogRepository,
    private readonly outboxRepository: IOutboxRepository,
  ) {}

  async execute(input: ICleanupLogsInput = {}): Promise<ICleanupLogsOutput> {
    const webhookRetentionDays = input.webhookLogRetentionDays ?? 30;
    const outboxRetentionDays = input.outboxRetentionDays ?? 30;

    // Delete old webhook logs
    const deletedWebhookLogs = await this.webhookLogRepository.deleteOldLogs(webhookRetentionDays);

    // Delete old processed outbox events
    const deletedOutboxEvents = await this.outboxRepository.deleteOldProcessed(outboxRetentionDays);

    return {
      deletedWebhookLogs,
      deletedOutboxEvents,
    };
  }
}
