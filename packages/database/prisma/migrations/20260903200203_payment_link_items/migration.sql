-- CreateTable
CREATE TABLE "payment_link_items" (
    "id" TEXT NOT NULL,
    "payment_link_id" TEXT NOT NULL,
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
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_link_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_link_items_payment_link_id_idx" ON "payment_link_items"("payment_link_id");

-- CreateIndex
CREATE INDEX "payment_link_items_product_id_idx" ON "payment_link_items"("product_id");

-- AddForeignKey
ALTER TABLE "payment_link_items" ADD CONSTRAINT "payment_link_items_payment_link_id_fkey" FOREIGN KEY ("payment_link_id") REFERENCES "payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_link_items" ADD CONSTRAINT "payment_link_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
