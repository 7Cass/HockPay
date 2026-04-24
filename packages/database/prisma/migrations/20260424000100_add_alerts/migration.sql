-- CreateEnum
CREATE TYPE "AlertChannel" AS ENUM ('DISCORD');

-- CreateEnum
CREATE TYPE "AlertDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "alert_configs" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "AlertChannel" NOT NULL,
    "encrypted_config" JSONB NOT NULL,
    "config_preview" JSONB NOT NULL,
    "events" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_delivery_logs" (
    "id" TEXT NOT NULL,
    "alert_config_id" TEXT NOT NULL,
    "outbox_event_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "event_type" TEXT NOT NULL,
    "channel" "AlertChannel" NOT NULL,
    "status" "AlertDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "response_status" INTEGER,
    "response_body" TEXT,
    "error_message" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "next_retry_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alert_configs_store_id_is_active_idx" ON "alert_configs"("store_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "alert_delivery_logs_alert_config_id_outbox_event_id_key" ON "alert_delivery_logs"("alert_config_id", "outbox_event_id");

-- CreateIndex
CREATE INDEX "alert_delivery_logs_alert_config_id_created_at_idx" ON "alert_delivery_logs"("alert_config_id", "created_at");

-- CreateIndex
CREATE INDEX "alert_delivery_logs_outbox_event_id_event_type_idx" ON "alert_delivery_logs"("outbox_event_id", "event_type");

-- AddForeignKey
ALTER TABLE "alert_configs" ADD CONSTRAINT "alert_configs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_delivery_logs" ADD CONSTRAINT "alert_delivery_logs_alert_config_id_fkey" FOREIGN KEY ("alert_config_id") REFERENCES "alert_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
