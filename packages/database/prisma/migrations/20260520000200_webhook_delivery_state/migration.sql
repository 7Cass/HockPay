-- Add explicit delivery state for webhook logs.
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED_RETRYABLE', 'FAILED_FINAL');

ALTER TABLE "webhook_logs"
  ADD COLUMN "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "failed_at" TIMESTAMP(3),
  ADD COLUMN "last_error" TEXT;

UPDATE "webhook_logs"
SET
  "status" = CASE
    WHEN "delivered_at" IS NOT NULL THEN 'DELIVERED'::"WebhookDeliveryStatus"
    WHEN "attempt" > 1 THEN 'FAILED_RETRYABLE'::"WebhookDeliveryStatus"
    ELSE 'PENDING'::"WebhookDeliveryStatus"
  END,
  "last_error" = CASE
    WHEN "delivered_at" IS NULL AND ("attempt" > 1 OR "response_status" IS NOT NULL)
      THEN "response_body"
    ELSE NULL
  END;

-- Webhook logs now represent the canonical delivery row for an outbox/config pair.
-- Prefer an already delivered row during backfill so old successful deliveries are not retried.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "config_id", "outbox_event_id"
      ORDER BY
        ("delivered_at" IS NOT NULL) DESC,
        "attempt" DESC,
        "created_at" DESC,
        "id" DESC
    ) AS row_number
  FROM "webhook_logs"
  WHERE "outbox_event_id" IS NOT NULL
)
DELETE FROM "webhook_logs"
USING ranked
WHERE "webhook_logs"."id" = ranked."id"
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX "webhook_logs_config_id_outbox_event_id_key"
  ON "webhook_logs"("config_id", "outbox_event_id");

CREATE INDEX "webhook_logs_status_next_retry_at_idx"
  ON "webhook_logs"("status", "next_retry_at");

CREATE INDEX "webhook_logs_outbox_event_id_status_idx"
  ON "webhook_logs"("outbox_event_id", "status");
