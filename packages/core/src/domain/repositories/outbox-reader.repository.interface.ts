import { OutboxEvent, OutboxEventStatus } from '../entities/outbox-event.entity';

export interface ClaimDispatchableEventsParams {
  limit: number;
  now?: Date;
  watchdogUntil: Date;
}

/**
 * Segregated interface for reading outbox events.
 *
 * This interface follows Interface Segregation Principle (ISP).
 * Used by Worker to fetch pending events for processing.
 */
export interface IOutboxReader {
  /**
   * Find an outbox event by ID.
   */
  findById(id: string): Promise<OutboxEvent | null>;

  /**
   * Find pending events ready for processing.
   * Returns events with status PENDING and nextRetryAt <= now.
   *
   * @param limit - Maximum number of events to return
   */
  findPendingEvents(limit: number): Promise<OutboxEvent[]>;

  /**
   * Find events that should be enqueued or re-enqueued by the dispatcher.
   * Includes ready PENDING events, retryable FAILED events, and DISPATCHED
   * events whose watchdog has expired.
   *
   * @param limit - Maximum number of events to return
   * @param now - Optional reference time, useful for deterministic tests
   */
  findDispatchableEvents(limit: number, now?: Date): Promise<OutboxEvent[]>;

  /**
   * Atomically claim events that should be enqueued or re-enqueued by the dispatcher.
   * Claimed rows are moved to DISPATCHED with nextRetryAt set to watchdogUntil.
   *
   * @param params.limit - Maximum number of events to claim
   * @param params.now - Optional reference time, useful for deterministic tests
   * @param params.watchdogUntil - Time after which a claimed event can be reclaimed
   */
  claimDispatchableEvents(params: ClaimDispatchableEventsParams): Promise<OutboxEvent[]>;

  /**
   * Find events by aggregate type and ID.
   */
  findByAggregate(aggregateType: string, aggregateId: string): Promise<OutboxEvent[]>;

  /**
   * Count events by status.
   */
  countByStatus(status: OutboxEventStatus): Promise<number>;

  /**
   * Delete old processed events (cleanup).
   *
   * @param olderThanDays - Delete events older than this many days
   */
  deleteOldProcessed(olderThanDays: number): Promise<number>;
}

/**
 * Segregated interface for updating outbox events.
 *
 * Used by Worker to mark events as processed or update retry state.
 */
export interface IOutboxUpdater {
  /**
   * Update an existing outbox event.
   */
  update(event: OutboxEvent): Promise<void>;

  /**
   * Reset an outbox event to a processor-runnable state before DLQ requeue.
   */
  resetForRequeue(id: string, watchdogUntil: Date): Promise<number>;
}
