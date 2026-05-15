-- CreateTable
CREATE TABLE "webhook_inbox_events" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "config_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "request_headers" JSONB,
    "request_id" TEXT,
    "delivery_id" TEXT,
    "outbox_event_id" TEXT,
    "payment_id" TEXT,
    "signature_valid" BOOLEAN NOT NULL DEFAULT false,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_inbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_inbox_events_config_id_received_at_idx" ON "webhook_inbox_events"("config_id", "received_at");

-- CreateIndex
CREATE INDEX "webhook_inbox_events_store_id_received_at_idx" ON "webhook_inbox_events"("store_id", "received_at");

-- CreateIndex
CREATE INDEX "webhook_inbox_events_outbox_event_id_idx" ON "webhook_inbox_events"("outbox_event_id");

-- AddForeignKey
ALTER TABLE "webhook_inbox_events" ADD CONSTRAINT "webhook_inbox_events_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_inbox_events" ADD CONSTRAINT "webhook_inbox_events_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "webhook_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_inbox_events" ADD CONSTRAINT "webhook_inbox_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
