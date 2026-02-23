/**
 * Port: Expiration Queue
 *
 * Interface for scheduling payment expiration jobs.
 * This port is implemented in the infrastructure layer using BullMQ.
 */
export interface IExpirationQueuePort {
  /**
   * Schedule a payment to expire at a specific time.
   *
   * @param paymentId - The ID of the payment to expire
   * @param expiresAt - When the payment should expire
   */
  scheduleExpiration(paymentId: string, expiresAt: Date): Promise<void>;

  /**
   * Cancel a scheduled expiration job.
   *
   * @param paymentId - The ID of the payment whose expiration should be cancelled
   */
  cancelExpiration(paymentId: string): Promise<void>;
}
