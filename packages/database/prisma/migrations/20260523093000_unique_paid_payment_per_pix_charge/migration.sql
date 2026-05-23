CREATE UNIQUE INDEX IF NOT EXISTS "payments_one_paid_per_pix_charge_idx"
ON "payments" ("pix_charge_id")
WHERE "pix_charge_id" IS NOT NULL
  AND "status" IN ('CONFIRMED', 'RELEASED');
