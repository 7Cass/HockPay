-- CreateEnum
CREATE TYPE "CustomerCollectionMode" AS ENUM ('IDENTIFIED', 'GUEST');

-- AlterTable
ALTER TABLE "checkout_sessions"
ADD COLUMN "customer_collection_mode" "CustomerCollectionMode" NOT NULL DEFAULT 'IDENTIFIED';

-- AlterTable
ALTER TABLE "payments"
ALTER COLUMN "customer_id" DROP NOT NULL,
ADD COLUMN "payer_name" TEXT,
ADD COLUMN "payer_document" TEXT,
ADD COLUMN "payer_email" TEXT;
