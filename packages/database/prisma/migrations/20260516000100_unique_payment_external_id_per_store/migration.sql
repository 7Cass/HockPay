-- Keep merchant-provided payment external IDs unique within a store.
-- PostgreSQL unique indexes allow multiple NULL external_id values.
CREATE UNIQUE INDEX "payments_store_id_external_id_key" ON "payments"("store_id", "external_id");
