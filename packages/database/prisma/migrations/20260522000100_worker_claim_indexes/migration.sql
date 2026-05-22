-- Indexes for atomic worker claims and stale processing recovery.
CREATE INDEX "outbox_events_status_next_retry_at_created_at_idx"
  ON "outbox_events"("status", "next_retry_at", "created_at");

CREATE INDEX "outbox_events_status_processed_at_next_retry_at_created_at_idx"
  ON "outbox_events"("status", "processed_at", "next_retry_at", "created_at");

CREATE INDEX "withdrawals_status_next_process_at_created_at_idx"
  ON "withdrawals"("status", "next_process_at", "created_at");

CREATE INDEX "withdrawals_status_updated_at_created_at_idx"
  ON "withdrawals"("status", "updated_at", "created_at");
