-- Add reservation/completion state for transactional idempotency.
CREATE TYPE "IdempotencyKeyStatus" AS ENUM ('PENDING', 'COMPLETED');

ALTER TABLE "idempotency_keys"
  ADD COLUMN "request_method" TEXT NOT NULL DEFAULT 'POST',
  ADD COLUMN "status" "IdempotencyKeyStatus" NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN "completed_at" TIMESTAMP(3);

UPDATE "idempotency_keys"
SET "completed_at" = "created_at"
WHERE "completed_at" IS NULL;

ALTER TABLE "idempotency_keys"
  ALTER COLUMN "response_body" DROP NOT NULL,
  ALTER COLUMN "response_status" DROP NOT NULL;

ALTER TABLE "idempotency_keys"
  ADD CONSTRAINT "idempotency_keys_status_response_check"
  CHECK (
    (
      "status" = 'PENDING'
      AND "response_body" IS NULL
      AND "response_status" IS NULL
      AND "completed_at" IS NULL
    )
    OR
    (
      "status" = 'COMPLETED'
      AND "response_body" IS NOT NULL
      AND "response_status" IS NOT NULL
      AND "completed_at" IS NOT NULL
    )
  );
