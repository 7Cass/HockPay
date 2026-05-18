# Hockpay

[![CI](https://github.com/7Cass/HockPay/actions/workflows/ci.yml/badge.svg)](https://github.com/7Cass/HockPay/actions/workflows/ci.yml)

Plataforma de pagamentos Pix simulada para desenvolvedores independentes e pequenas startups. O repositório atual é um monorepo `pnpm` + Turborepo com aplicações NestJS, Angular e Next.js.

> Este projeto não processa dinheiro real. A documentação abaixo separa explicitamente o que já existe no código do que é arquitetura alvo.

## Estado da Documentação

- `Atual`: descreve comportamento verificado no código e nos scripts do repositório
- `Alvo`: descreve direção de arquitetura e produto ainda não implementada por completo

## Quick Start Atual

```bash
# 1. Instalar dependências
pnpm install

# 2. Subir PostgreSQL e Redis
docker compose -f infrastructure/docker/docker-compose.yml up -d

# 3. Gerar cliente Prisma e aplicar migrations locais
pnpm run db:generate
pnpm run db:migrate

# 4. Rodar o monorepo em desenvolvimento
pnpm run dev
```

## Topologia Atual do Monorepo

| Diretório                 | Papel atual                                                                                                                               | Stack      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `apps/api`                | API REST principal com autenticação, stores, customers, payments, webhooks, checkout sessions, dashboard, refunds e afins                 | NestJS     |
| `apps/worker`             | Worker separado com BullMQ, cron jobs e processamento assíncrono de outbox/webhooks                                                       | NestJS     |
| `apps/web`                | App Angular único com landing page, login/register, dashboard do merchant, timeline de payment, receipts, webhooks e financeiro read-only | Angular    |
| `apps/checkout`           | Checkout white-label orientado ao comprador, baseado em token de checkout session                                                         | Next.js    |
| `apps/demo-mediakit`      | Demo de integração usando checkout hospedado + webhook                                                                                    | Next.js    |
| `packages/core`           | Entidades, value objects, interfaces e casos de uso compartilhados                                                                        | TypeScript |
| `packages/database`       | Schema Prisma, migrations e cliente compartilhado                                                                                         | Prisma     |
| `packages/infrastructure` | Repositórios compartilhados e `UnitOfWork` baseados em Prisma, além de criptografia                                                       | TypeScript |

## Integração Atual da API

A API local escuta em `http://localhost:3000` e usa prefixo global `/api` com versionamento por URI. A base dos exemplos atuais é:

```text
http://localhost:3000/api/v1
```

```bash
# Criar um pagamento
curl -X POST http://localhost:3000/api/v1/payments \
  -H "Authorization: Bearer hk_test_sua_api_key_aqui" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: pedido-123" \
  -d '{
    "amount": 1500,
    "customer": {
      "name": "João Silva",
      "email": "joao@email.com",
      "document": "<CPF_DO_CLIENTE>"
    }
  }'

# Simular confirmação em dev mode
curl -X POST http://localhost:3000/api/v1/dev/simulate/{payment_id}/confirm \
  -H "Authorization: Bearer hk_test_sua_api_key_aqui"

# Criar um saque API-first (conta Pix verificada e saldo disponível obrigatórios)
curl -X POST http://localhost:3000/api/v1/withdrawals \
  -H "Authorization: Bearer hk_test_sua_api_key_aqui" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: saque-123" \
  -d '{
    "bankAccountId": "bank_account_id",
    "amount": 10000
  }'
```

Saques usam `JWT + API key` via `CombinedAuthGuard`. No v1 as API keys ainda não têm scopes granulares; trate `POST /withdrawals` como operação financeira sensível e reserve o futuro scope `withdrawals:create`.

## Infraestrutura Atual

- Banco: PostgreSQL 15 via Docker Compose
- Cache/fila: Redis 7 via Docker Compose
- Filas assíncronas: BullMQ sobre Redis
- Fluxo completo local: PostgreSQL + Redis + API + worker são obrigatórios
- PostgreSQL é obrigatório para Prisma, autenticação, payments, accounts, receipts, outbox e logs
- Redis é obrigatório para BullMQ, expiração agendada, entrega de webhooks e cache operacional de idempotência/throttling
- API sem worker cria dados e outbox, mas não entrega webhooks nem processa jobs assíncronos
- Invariante atual: toda `store` criada pela API nasce com uma `account`; a migration atual faz backfill de stores antigas sem account
- Checkout hospedado: o default local usa `http://localhost:3000/api/v1`
- Study case atual validado: `apps/demo-mediakit`
- P3 fechado nesta rodada: template/checklist/docs/smoke alinhados, com receipts, timeline de payment e visibilidade financeira como capacidades reais de dashboard/API
- Products, Marketplace, split e multi-seller continuam fora do produto pronto e pertencem a P4/futuro; saques existem como capacidade API-first sem dashboard nesta etapa
- O proximo study-case ainda nao foi escolhido nesta rodada; `demo-mediakit` serve como referencia/template/checklist
- Não existe LocalStack nem SQS configurado no estado atual

## Smokes Locais

| Script                              | Papel                                                                                                                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run smoke:p0`                 | Baseline rapido de API direta: cria merchant/store/API key, payment direto, webhook local, confirmacao e entrega pelo worker                                                                  |
| `pnpm run smoke:payment-link`       | Validacao de Payment Link/checkout hospedado: PixCharge aberta, falha de tentativa, nova tentativa paga e conversao                                                                           |
| `pnpm run smoke:p3:visual`          | Validacao visual do dashboard: popula payments em todos os estados principais para conferir timeline, receipt, financeiro e empty states                                                      |
| `pnpm run smoke:studycase:mediakit` | Validacao completa do study-case `demo-mediakit`: cria merchant/store/API key/webhook, sobe o demo, cria checkout session, faz fulfill, confirma payment TEST e valida webhook + estado final |
| `pnpm run smoke:docker`             | Orquestra smoke local com Postgres/Redis em Docker e API, worker e checkout como processos Node no host                                                                                       |

O smoke Docker e local-first nesta rodada e nao roda como gate bloqueante de CI. Ele usa `infrastructure/docker/docker-compose.smoke.yml`, portas isoladas `15432`/`16379` para infra e portas de app `3000`/`3001`/`3333` no host.

```bash
pnpm run smoke:docker
HOCKPAY_SMOKE_SUITE=p0,payment-link pnpm run smoke:docker
HOCKPAY_SMOKE_CLEAN_VOLUMES=true pnpm run smoke:docker
```

Opcoes principais: `HOCKPAY_SMOKE_SUITE=p0,payment-link,p3,studycase,system`, `HOCKPAY_SMOKE_KEEP_ALIVE=true`, `HOCKPAY_SMOKE_CLEAN_VOLUMES=true` e `HOCKPAY_SMOKE_MIGRATE_MODE=deploy|dev`.

Um smoke "tudo Docker" com API/worker/checkout tambem containerizados fica para etapa futura. O bloqueio conhecido e tornar configuravel a URL do receiver de webhook a partir dos containers, porque hoje os smokes usam receiver local em `127.0.0.1`.

## CI Atual

O baseline de CI em GitHub Actions usa Node 22 e pnpm 9.15.0 com cache pnpm e `.turbo`. Ele cobre:

- `build`: `pnpm db:generate` e `pnpm build`
- `test`: `@hockpay/core test:ci`, `@hockpay/infrastructure test`, `@hockpay/api test`, `@hockpay/worker test`
- `api-e2e`: `pnpm --filter @hockpay/api test:e2e`

`pnpm lint` ainda nao entra no CI porque os scripts atuais usam `--fix` e poderiam mutar arquivos no runner. Os smokes Docker permanecem locais por enquanto.

## Troubleshooting Rápido

| Sintoma                               | Verificação                                                     |
| ------------------------------------- | --------------------------------------------------------------- |
| `health/live` não responde            | confirme que `apps/api` está rodando na porta `3000`            |
| `health/ready` falha                  | confira `DATABASE_URL`, PostgreSQL e migrations                 |
| Pagamento cria mas webhook não chega  | confirme Redis e `apps/worker` rodando                          |
| Jobs BullMQ não processam             | confira `REDIS_HOST`/`REDIS_PORT` nos processos API e worker    |
| Endpoints de dashboard retornam `401` | use cookie JWT de login; API key é para endpoints de integração |

## Scripts de Workspace Disponíveis

| Script                  | Descrição                                               |
| ----------------------- | ------------------------------------------------------- |
| `pnpm run dev`          | Roda `dev` em todos os workspaces configurados no Turbo |
| `pnpm run build`        | Build de todos os workspaces                            |
| `pnpm run test`         | Testes dos workspaces                                   |
| `pnpm run test:e2e`     | Testes E2E dos workspaces que expõem esse script        |
| `pnpm run lint`         | Lint dos workspaces                                     |
| `pnpm run format`       | Formata arquivos compatíveis com Prettier               |
| `pnpm run smoke:docker` | Orquestra infra Docker local e smokes sequenciais       |
| `pnpm run db:generate`  | `prisma generate` no pacote `@hockpay/database`         |
| `pnpm run db:migrate`   | `prisma migrate dev` no pacote `@hockpay/database`      |
| `pnpm run db:deploy`    | `prisma migrate deploy` no pacote `@hockpay/database`   |

## Mapa de Documentação

- [TECHNICAL_OVERVIEW.md](./TECHNICAL_OVERVIEW.md): visão arquitetural dual-state, separando implementação atual e arquitetura alvo
- [DATA_MODELING.md](./DATA_MODELING.md): modelo de dados atual, cobertura runtime e modelo alvo
- [docs/CURRENT_STATE_AUDIT.md](./docs/CURRENT_STATE_AUDIT.md): resumo auditado do estado atual, fechamento P1-P3, limites de P4 e criterios para escolher o proximo study-case
- [docs/P0_RUNBOOK.md](./docs/P0_RUNBOOK.md): operação reproduzível do fluxo P0 local
- [docs/TECH_SPEC.md](./docs/TECH_SPEC.md): especificação alvo, com status atual de implementação
- [docs/BUSINESS_PRD.md](./docs/BUSINESS_PRD.md): visão de produto e cobertura atual do MVP
- [CLAUDE.md](./CLAUDE.md): instruções locais de desenvolvimento para agentes

## Direção Alvo

A direção desejada continua sendo uma plataforma Dev-First de pagamentos simulados com separação limpa entre core, delivery e experiências de frontend. O detalhamento dessa arquitetura alvo está em [docs/TECH_SPEC.md](./docs/TECH_SPEC.md) e nas seções `Arquitetura Alvo` de [TECHNICAL_OVERVIEW.md](./TECHNICAL_OVERVIEW.md).

## Licença

MIT
