import {
  OutboxEvent,
  OutboxEventStatus,
} from "../entities/outbox-event.entity";

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
   * Find events by aggregate type and ID.
   */
  findByAggregate(
    aggregateType: string,
    aggregateId: string,
  ): Promise<OutboxEvent[]>;

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
}
