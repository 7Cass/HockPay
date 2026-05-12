-- Add request tracing fields to outbox and webhook delivery logs.
ALTER TABLE "outbox_events" ADD COLUMN "request_id" TEXT;

ALTER TABLE "webhook_logs"
ADD COLUMN "outbox_event_id" TEXT,
ADD COLUMN "request_id" TEXT;

CREATE INDEX "outbox_events_request_id_idx" ON "outbox_events"("request_id");
CREATE INDEX "webhook_logs_outbox_event_id_idx" ON "webhook_logs"("outbox_event_id");
CREATE INDEX "webhook_logs_request_id_idx" ON "webhook_logs"("request_id");
