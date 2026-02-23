import { OutboxEvent } from '../entities/outbox-event.entity';

/**
 * Segregated interface for writing outbox events.
 *
 * This interface follows Interface Segregation Principle (ISP).
 * Used by API to create new events.
 */
export interface IOutboxWriter {
  /**
   * Save a new outbox event.
   */
  save(event: OutboxEvent): Promise<void>;
}
