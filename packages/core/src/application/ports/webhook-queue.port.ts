/**
 * Port: Webhook Queue
 *
 * Interface for enqueueing webhook delivery jobs.
 * This port is implemented in the infrastructure layer using BullMQ.
 */
export interface IWebhookQueuePort {
  /**
   * Enqueue a webhook delivery job.
   *
   * @param eventId - The outbox event ID to process
   * @param delay - Optional delay in milliseconds
   */
  enqueue(eventId: string, delay?: number, requestId?: string): Promise<void>;
}

/**
 * Webhook job data structure.
 */
export interface WebhookJobData {
  eventId: string;
  attempt: number;
  requestId?: string;
}
