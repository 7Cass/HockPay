# Hockpay

[![CI](https://github.com/7Cass/HockPay/actions/workflows/ci.yml/badge.svg)](https://github.com/7Cass/HockPay/actions/workflows/ci.yml)

Hockpay e uma plataforma dev-first de pagamentos simulados. O monorepo usa `pnpm` + Turborepo com API NestJS, worker NestJS, dashboard Angular, checkout Next.js e pacotes compartilhados.

Este projeto nao processa dinheiro real. Pix, Payment Links, checkout e saques existem como simulacao local/TEST para desenvolvimento, demos e estudo.

## Quick Start

```bash
pnpm install
docker compose -f infrastructure/docker/docker-compose.yml up -d
pnpm run db:generate
pnpm run db:migrate
pnpm run dev
```

Base local da API:

```text
http://localhost:3000/api/v1
```

Para variáveis de ambiente por app e opções de smoke local, use a matriz do [Runbook](./docs/RUNBOOK.md#vari%C3%A1veis-de-ambiente-por-app). A raiz também possui `.env.example` com placeholders seguros.

## Monorepo

| Caminho | Papel |
| --- | --- |
| `apps/api` | API REST com auth, stores, products, payments, Payment Links, checkout sessions, webhooks, alerts, receipts, financials, bank accounts e withdrawals. |
| `apps/worker` | Jobs assincronos com BullMQ/Redis: outbox, webhooks, alertas, expiracao, settlement, saques simulados e limpeza. |
| `apps/web` | Landing, auth e dashboard do merchant. |
| `apps/checkout` | Checkout do comprador para checkout sessions e Payment Links publicos. |
| `apps/demo-mediakit` | Study-case de referencia. |
| `packages/core` | Dominio, portas e use cases. |
| `packages/database` | Prisma schema, migrations e cliente. |
| `packages/infrastructure` | Repositorios Prisma, `UnitOfWork` e adapters compartilhados. |

## Capacidades Atuais

- Pagamentos Pix simulados com idempotencia, customer on-the-fly, receipt, timeline e webhooks.
- Products como catalogo opcional store-scoped para checkout sessions, separado por TEST/LIVE.
- Payment Links publicos em `/pay/:token`, com `PixCharge` e tentativas de pagamento por valor avulso ou por itens do catalogo, e ciclo de vida proprio em `payment_link.*`.
- Webhooks com envelope versionado por tipo de evento e catalogo em [docs/EVENTS.md](docs/EVENTS.md).
- Checkout sessions hospedadas para demos e integracoes, com valor direto ou itens de produtos.
- Dashboard para payments, customers, products, API keys, webhooks, alerts, receipts, financials e withdrawals.
- Saques simulados com bank accounts, reserva de saldo, ledger, summary, timeline, worker e acoes TEST.
- `POST /api/v1/payments` segue como API direta de baixo nivel, sem `items` neste corte.
- Settings edita nome e cidade da loja; fee/settlement continuam imutaveis. Marketplace, split e multi-seller estao fora do escopo atual.

## Smokes

```bash
pnpm run smoke:p0
pnpm run smoke:payment-link
pnpm run smoke:webhook-isolation
pnpm run smoke:p3:visual
pnpm run smoke:studycase:mediakit
pnpm run smoke:system
pnpm run smoke:withdrawals
pnpm run smoke:docker
```

`pnpm run smoke:docker` sobe Postgres/Redis em Docker e roda API, worker e checkout como processos Node no host. A suite default e `p0,payment-link,p3,studycase,system,withdrawals`.
Para a suite default completa, siga os defaults e timeout recomendados no [Runbook](./docs/RUNBOOK.md#smoke-docker-local).

## CI

GitHub Actions roda lint/format (API/worker), build, testes de core/infrastructure/api/worker, testes do dashboard e API e2e em todo PR. Smoke `p0,payment-link` roda no cron diario e em `workflow_dispatch`.

## Documentacao

- [Estado atual](./docs/CURRENT_STATE.md)
- [Produto](./docs/PRODUCT.md)
- [Modelo de dados](./docs/DATA_MODEL.md)
- [Catalogo de eventos](./docs/EVENTS.md)
- [PRD - Superficie de operador](./docs/PRD_OPERATOR_SURFACE.md) (proposta, nao implementada)
- [PRD - Fronteira de autorizacao de operador](./docs/PRD_OPERATOR_AUTHZ.md) (fatia 1 da superficie de operador, implementada)
- [PRD - Ledger por ambiente](./docs/PRD_ENVIRONMENT_LEDGER.md) (proposta, fatia 2 da superficie de operador)
- [Runbook](./docs/RUNBOOK.md)
- [Arquitetura alvo](./docs/TARGET_ARCHITECTURE.md)

## Licença

MIT
