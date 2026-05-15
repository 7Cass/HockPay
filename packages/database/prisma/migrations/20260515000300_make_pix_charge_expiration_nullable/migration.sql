-- Allow payment-link Pix charges to have no expiration date.
ALTER TABLE "pix_charges"
ALTER COLUMN "expires_at" DROP NOT NULL;

-- Keep existing payment-link-backed charges aligned with links that already
-- have no expiration.
UPDATE "pix_charges" pc
SET "expires_at" = NULL
FROM "payment_links" pl
WHERE pl."pix_charge_id" = pc."id"
  AND pl."expires_at" IS NULL;
