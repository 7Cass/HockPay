/*
  Warnings:

  - You are about to drop the column `created_at` on the `refresh_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `expires_at` on the `refresh_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `merchant_id` on the `refresh_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `revoked_at` on the `refresh_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `token_hash` on the `refresh_tokens` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[token]` on the table `refresh_tokens` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[merchantId]` on the table `refresh_tokens` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `expiresAt` to the `refresh_tokens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `merchantId` to the `refresh_tokens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `token` to the `refresh_tokens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `refresh_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_merchant_id_fkey";

-- DropIndex
DROP INDEX "refresh_tokens_merchant_id_idx";

-- DropIndex
DROP INDEX "refresh_tokens_token_hash_idx";

-- AlterTable
ALTER TABLE "refresh_tokens" DROP COLUMN "created_at",
DROP COLUMN "expires_at",
DROP COLUMN "merchant_id",
DROP COLUMN "revoked_at",
DROP COLUMN "token_hash",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "merchantId" TEXT NOT NULL,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "token" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_merchantId_key" ON "refresh_tokens"("merchantId");

-- CreateIndex
CREATE INDEX "refresh_tokens_merchantId_idx" ON "refresh_tokens"("merchantId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
