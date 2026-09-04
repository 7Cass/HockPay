-- Versao do envelope congelada na producao do evento.
--
-- Eventos que ja existem nasceram sob o contrato v1, entao o default cobre o
-- backfill: nao ha linha antiga que precise de UPDATE.
ALTER TABLE "outbox_events" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
