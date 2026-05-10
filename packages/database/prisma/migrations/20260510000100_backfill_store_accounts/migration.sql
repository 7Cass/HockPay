-- Backfill the P0 invariant: every store must have exactly one financial account.
-- Old databases may contain stores created before repository-level account creation.

INSERT INTO "accounts" (
    "id",
    "store_id",
    "available",
    "pending",
    "blocked",
    "currency",
    "updated_at"
)
SELECT
    CONCAT('acct_', s."id"),
    s."id",
    0,
    0,
    0,
    'BRL',
    CURRENT_TIMESTAMP
FROM "stores" s
WHERE NOT EXISTS (
    SELECT 1
    FROM "accounts" a
    WHERE a."store_id" = s."id"
)
ON CONFLICT ("store_id") DO NOTHING;
