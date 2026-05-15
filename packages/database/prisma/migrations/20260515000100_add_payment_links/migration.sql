-- CreateEnum
CREATE TYPE "PixChargeStatus" AS ENUM ('OPEN', 'PAID', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "pix_charges" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" "PixChargeStatus" NOT NULL DEFAULT 'OPEN',
    "pix_qr_code" TEXT NOT NULL,
    "pix_copy_paste" TEXT NOT NULL,
    "pix_tx_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pix_charges_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "pix_charge_id" TEXT;

-- Migrate existing Pix payloads from payments into reusable charges before
-- dropping the old columns.
INSERT INTO "pix_charges" (
    "id",
    "store_id",
    "amount",
    "currency",
    "status",
    "pix_qr_code",
    "pix_copy_paste",
    "pix_tx_id",
    "expires_at",
    "paid_at",
    "created_at",
    "updated_at"
)
SELECT
    'pix_' || "id",
    "store_id",
    "amount",
    "currency",
    CASE
        WHEN "status" IN ('CONFIRMED', 'RELEASED', 'REFUNDED') THEN 'PAID'::"PixChargeStatus"
        WHEN "status" = 'EXPIRED' THEN 'EXPIRED'::"PixChargeStatus"
        WHEN "status" = 'FAILED' THEN 'CANCELLED'::"PixChargeStatus"
        ELSE 'OPEN'::"PixChargeStatus"
    END,
    COALESCE("pix_qr_code", ''),
    COALESCE("pix_copy_paste", ''),
    "pix_tx_id",
    "expires_at",
    "paid_at",
    "created_at",
    "updated_at"
FROM "payments"
WHERE "pix_tx_id" IS NOT NULL;

UPDATE "payments"
SET "pix_charge_id" = 'pix_' || "id"
WHERE "pix_tx_id" IS NOT NULL;

-- AlterTable
ALTER TABLE "payments"
DROP COLUMN "pix_qr_code",
DROP COLUMN "pix_copy_paste",
DROP COLUMN "pix_tx_id";

-- CreateTable
CREATE TABLE "payment_links" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "pix_charge_id" TEXT NOT NULL,
    "public_token" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "title" TEXT,
    "description" TEXT,
    "internal_reference" TEXT,
    "expires_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pix_charges_pix_tx_id_key" ON "pix_charges"("pix_tx_id");

-- CreateIndex
CREATE INDEX "pix_charges_store_id_status_idx" ON "pix_charges"("store_id", "status");

-- CreateIndex
CREATE INDEX "pix_charges_expires_at_idx" ON "pix_charges"("expires_at");

-- CreateIndex
CREATE INDEX "payments_pix_charge_id_idx" ON "payments"("pix_charge_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_links_pix_charge_id_key" ON "payment_links"("pix_charge_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_links_public_token_key" ON "payment_links"("public_token");

-- CreateIndex
CREATE INDEX "payment_links_store_id_created_at_idx" ON "payment_links"("store_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "payment_links_store_id_opened_at_idx" ON "payment_links"("store_id", "opened_at");

-- CreateIndex
CREATE INDEX "payment_links_store_id_cancelled_at_idx" ON "payment_links"("store_id", "cancelled_at");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_pix_charge_id_fkey" FOREIGN KEY ("pix_charge_id") REFERENCES "pix_charges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pix_charges" ADD CONSTRAINT "pix_charges_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_pix_charge_id_fkey" FOREIGN KEY ("pix_charge_id") REFERENCES "pix_charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
