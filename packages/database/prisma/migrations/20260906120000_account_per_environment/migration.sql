-- Ledger por ambiente: uma conta por loja e ambiente.
--
-- O saldo existente e integralmente TEST, e isso e verificavel, nao suposto:
-- todo caminho que credita conta hoje recusa LIVE (`/dev/simulate` rejeita key
-- LIVE, pay de Payment Link e fulfill de checkout recusam LIVE no use case, e
-- refund/saque sao JWT-only, sempre TEST). Nenhum Payment LIVE chegou a
-- CONFIRMED, entao nao ha saldo misto para dividir.
--
-- Por isso esta migration e um corte: a conta que existe vira a conta TEST, e a
-- conta LIVE de cada loja nasce zerada.

ALTER TABLE "accounts" ADD COLUMN "environment" "Environment" NOT NULL DEFAULT 'TEST';

DROP INDEX "accounts_store_id_key";

CREATE UNIQUE INDEX "accounts_store_id_environment_key" ON "accounts"("store_id", "environment");

-- Toda loja precisa das duas contas, do mesmo jeito que toda loja precisava de
-- uma em 20260510000100_backfill_store_accounts.
INSERT INTO "accounts" (
    "id",
    "store_id",
    "environment",
    "available",
    "pending",
    "blocked",
    "currency",
    "updated_at"
)
SELECT
    CONCAT('acct_live_', s."id"),
    s."id",
    'LIVE',
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
      AND a."environment" = 'LIVE'
);
