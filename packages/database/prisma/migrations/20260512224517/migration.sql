-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CREDIT_CARD', 'BOLETO', 'DEBIT_CARD');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('ISSUED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "refunds" DROP CONSTRAINT "refunds_payment_id_fkey";

-- DropIndex
DROP INDEX "refunds_payment_id_key";

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "acquirer_id" TEXT,
ADD COLUMN     "payment_details" JSONB,
ADD COLUMN     "payment_method" "PaymentMethod" NOT NULL DEFAULT 'PIX',
ADD COLUMN     "total_refunded" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "payer_name" TEXT,
    "payer_document" TEXT,
    "payer_email" TEXT,
    "payee_name" TEXT NOT NULL,
    "payee_document" TEXT,
    "amount" INTEGER NOT NULL,
    "fee" INTEGER NOT NULL,
    "net_amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "description" TEXT,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'ISSUED',
    "issued_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_counters" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "receipt_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "receipts_receipt_number_key" ON "receipts"("receipt_number");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_payment_id_key" ON "receipts"("payment_id");

-- CreateIndex
CREATE INDEX "receipts_store_id_idx" ON "receipts"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_counters_store_id_date_key" ON "receipt_counters"("store_id", "date");

-- CreateIndex
CREATE INDEX "outbox_events_status_next_retry_at_idx" ON "outbox_events"("status", "next_retry_at");

-- CreateIndex
CREATE INDEX "payments_store_id_status_idx" ON "payments"("store_id", "status");

-- CreateIndex
CREATE INDEX "payments_store_id_created_at_idx" ON "payments"("store_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "payments_expires_at_idx" ON "payments"("expires_at");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE INDEX "webhook_logs_config_id_delivered_at_idx" ON "webhook_logs"("config_id", "delivered_at");

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_counters" ADD CONSTRAINT "receipt_counters_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
