import {
  OutboxEvent,
  OutboxEventProps,
  OutboxEventStatus,
} from '../entities/outbox-event.entity';

/**
 * Repository interface for OutboxEvent aggregate.
 *
 * Provides persistence operations for the outbox pattern.
 */
export interface IOutboxRepository {
  /**
   * Save a new outbox event.
   */
  save(event: OutboxEvent): Promise<void>;

  /**
   * Update an existing outbox event.
   */
  update(event: OutboxEvent): Promise<void>;

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
