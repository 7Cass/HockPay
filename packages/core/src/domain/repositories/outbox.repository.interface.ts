import { IOutboxWriter } from './outbox-writer.repository.interface';
import {
  IOutboxReader,
  IOutboxUpdater,
} from './outbox-reader.repository.interface';

/**
 * Repository interface for OutboxEvent aggregate.
 *
 * Provides persistence operations for the outbox pattern.
 * This interface combines all segregated interfaces for full repository access.
 *
 * For ISP compliance, use the specific interfaces:
 * - IOutboxWriter: API writes events
 * - IOutboxReader: Worker reads pending events
 * - IOutboxUpdater: Worker updates event status
 */
export interface IOutboxRepository
  extends IOutboxWriter,
    IOutboxReader,
    IOutboxUpdater {}

// Re-export segregated interfaces
export type { IOutboxWriter, IOutboxReader, IOutboxUpdater };
