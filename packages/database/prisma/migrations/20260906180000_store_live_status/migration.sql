-- Habilitacao de loja para LIVE (fatia 3 da superficie de operador).
--
-- Nenhuma loja existente muda de comportamento. `is_approved` nasce `true` em
-- toda linha (`// Auto-approve for MVP`) e nunca teve caminho de escrita, entao
-- os gates que o liam eram no-ops que duplicavam `is_active`. E `NOT_REQUESTED`
-- descreve exatamente o que ja e verdade hoje: a loja opera em TEST e o ledger
-- LIVE dela esta fechado e zerado.

CREATE TYPE "StoreLiveStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

ALTER TABLE "stores"
  ADD COLUMN "live_status" "StoreLiveStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN "live_status_reason" TEXT,
  ADD COLUMN "live_status_changed_at" TIMESTAMP(3);

ALTER TABLE "stores" DROP COLUMN "is_approved";
