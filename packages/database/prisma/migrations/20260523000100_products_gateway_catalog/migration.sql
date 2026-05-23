-- Products gateway catalog

ALTER TABLE "products"
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "environment" "Environment" NOT NULL DEFAULT 'TEST';

UPDATE "products"
SET "price" = 1
WHERE "price" IS NULL;

ALTER TABLE "products"
  ALTER COLUMN "price" SET NOT NULL;

ALTER TABLE "products"
  ADD CONSTRAINT "products_price_positive_check" CHECK ("price" >= 1),
  ADD CONSTRAINT "products_currency_brl_check" CHECK ("currency" = 'BRL');

CREATE UNIQUE INDEX "products_store_id_environment_external_id_key"
  ON "products"("store_id", "environment", "external_id");

CREATE INDEX "products_store_id_environment_is_active_idx"
  ON "products"("store_id", "environment", "is_active");

CREATE INDEX "products_store_id_environment_created_at_idx"
  ON "products"("store_id", "environment", "created_at" DESC);

ALTER TABLE "payment_items"
  ADD COLUMN "product_external_id" TEXT,
  ADD COLUMN "image_url" TEXT,
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "payment_items"
  ADD CONSTRAINT "payment_items_quantity_positive_check" CHECK ("quantity" >= 1),
  ADD CONSTRAINT "payment_items_unit_price_positive_check" CHECK ("unit_price" >= 1),
  ADD CONSTRAINT "payment_items_total_price_matches_check" CHECK ("total_price" = ("quantity" * "unit_price"));

CREATE INDEX "payment_items_payment_id_idx"
  ON "payment_items"("payment_id");

CREATE INDEX "payment_items_product_id_idx"
  ON "payment_items"("product_id");

ALTER TABLE "checkout_sessions"
  ADD COLUMN "environment" "Environment" NOT NULL DEFAULT 'TEST';

ALTER TABLE "payment_links"
  ADD COLUMN "environment" "Environment" NOT NULL DEFAULT 'TEST';

CREATE TABLE "checkout_session_items" (
  "id" TEXT NOT NULL,
  "checkout_session_id" TEXT NOT NULL,
  "product_id" TEXT,
  "product_external_id" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unit_price" INTEGER NOT NULL,
  "total_price" INTEGER NOT NULL,
  "image_url" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "checkout_session_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "checkout_session_items"
  ADD CONSTRAINT "checkout_session_items_quantity_positive_check" CHECK ("quantity" >= 1),
  ADD CONSTRAINT "checkout_session_items_unit_price_positive_check" CHECK ("unit_price" >= 1),
  ADD CONSTRAINT "checkout_session_items_total_price_matches_check" CHECK ("total_price" = ("quantity" * "unit_price"));

CREATE INDEX "checkout_session_items_checkout_session_id_idx"
  ON "checkout_session_items"("checkout_session_id");

CREATE INDEX "checkout_session_items_product_id_idx"
  ON "checkout_session_items"("product_id");

ALTER TABLE "checkout_session_items"
  ADD CONSTRAINT "checkout_session_items_checkout_session_id_fkey"
  FOREIGN KEY ("checkout_session_id") REFERENCES "checkout_sessions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "checkout_session_items"
  ADD CONSTRAINT "checkout_session_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
