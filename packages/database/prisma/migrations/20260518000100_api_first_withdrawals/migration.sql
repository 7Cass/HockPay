ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'WITHDRAWAL_RESERVED';

ALTER TABLE "withdrawals"
  ADD COLUMN IF NOT EXISTS "processing_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "next_process_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_processing_error" TEXT;

CREATE INDEX IF NOT EXISTS "withdrawals_account_id_status_created_at_idx"
  ON "withdrawals"("account_id", "status", "created_at");

CREATE INDEX IF NOT EXISTS "withdrawals_bank_account_id_idx"
  ON "withdrawals"("bank_account_id");

CREATE INDEX IF NOT EXISTS "withdrawals_status_next_process_at_idx"
  ON "withdrawals"("status", "next_process_at");

ALTER TABLE "webhook_logs"
  ADD COLUMN IF NOT EXISTS "aggregate_type" TEXT,
  ADD COLUMN IF NOT EXISTS "aggregate_id" TEXT;

CREATE INDEX IF NOT EXISTS "webhook_logs_aggregate_type_aggregate_id_idx"
  ON "webhook_logs"("aggregate_type", "aggregate_id");
