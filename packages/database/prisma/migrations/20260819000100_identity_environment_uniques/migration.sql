-- Isolate payment external IDs and idempotency keys by TEST/LIVE.

DROP INDEX IF EXISTS "payments_store_id_external_id_key";

CREATE UNIQUE INDEX "payments_store_id_environment_external_id_key"
ON "payments"("store_id", "environment", "external_id");

ALTER TABLE "idempotency_keys"
ADD COLUMN "environment" "Environment" NOT NULL DEFAULT 'TEST';

DROP INDEX IF EXISTS "idempotency_keys_key_store_id_key";

CREATE UNIQUE INDEX "idempotency_keys_key_store_id_environment_key"
ON "idempotency_keys"("key", "store_id", "environment");
