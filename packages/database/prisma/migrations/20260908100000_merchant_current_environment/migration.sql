-- O ambiente de uma sessao de merchant passa a morar no proprio merchant,
-- ao lado de `current_store_id` -- que e exatamente o mesmo tipo de fato.
--
-- Sem backfill. `TEST` para todo merchant existente e literalmente o que ja e
-- verdade hoje: `combined-auth.guard.ts` escrevia `Environment.TEST` para toda
-- sessao JWT, por linha de codigo. O enum `Environment` ja existe no schema.

ALTER TABLE "merchants"
  ADD COLUMN "current_environment" "Environment" NOT NULL DEFAULT 'TEST';
