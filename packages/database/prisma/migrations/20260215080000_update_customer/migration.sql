-- AlterTable
ALTER TABLE "customers" ADD COLUMN "street" TEXT;
ALTER TABLE "customers" ADD COLUMN "number" TEXT;
ALTER TABLE "customers" ADD COLUMN "complement" TEXT;
ALTER TABLE "customers" ADD COLUMN "city" TEXT;
ALTER TABLE "customers" ADD COLUMN "state" TEXT;
ALTER TABLE "customers" ADD COLUMN "zip_code" TEXT;
ALTER TABLE "customers" ADD COLUMN "country" TEXT DEFAULT 'BR';

-- CreateIndex
CREATE UNIQUE INDEX "customers_store_id_document_key" ON "customers"("store_id", "document");

-- CreateIndex
CREATE UNIQUE INDEX "customers_store_id_external_id_key" ON "customers"("store_id", "external_id");
