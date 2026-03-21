/*
  Warnings:

  - You are about to drop the column `checkout_url` on the `payments` table. All the data in the column will be lost.
  - Added the required column `prefix` to the `webhook_configs` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('OPEN', 'COMPLETED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "OutboxStatus" ADD VALUE 'DISPATCHED';

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "checkout_url",
ADD COLUMN     "environment" "Environment" NOT NULL DEFAULT 'TEST';

-- AlterTable
ALTER TABLE "webhook_configs" ADD COLUMN     "prefix" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "checkout_sessions" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "description" TEXT,
    "payment_id" TEXT,
    "checkout_token" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'OPEN',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "success_url" TEXT,
    "cancel_url" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checkout_sessions_payment_id_key" ON "checkout_sessions"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "checkout_sessions_checkout_token_key" ON "checkout_sessions"("checkout_token");

-- AddForeignKey
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
