-- AlterTable
ALTER TABLE "checkout_session_items" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payment_items" ALTER COLUMN "updated_at" DROP DEFAULT;
