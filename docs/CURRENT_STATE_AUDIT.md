# Hockpay — Current State Audit

Resumo curto e auditado do estado atual do repositório.

## Apps

| App | Estado atual |
|-----|--------------|
| `apps/api` | API NestJS em `/api/v1`, com auth híbrida, payments, checkout sessions, webhooks, dashboard, refunds, stores, customers, bank accounts e módulos auxiliares |
| `apps/worker` | Worker NestJS com Redis/BullMQ, cron jobs e processamento de outbox/webhooks |
| `apps/web` | Angular único para landing, auth e dashboard |
| `apps/checkout` | Next.js para checkout hospedado baseado em token |
| `apps/demo-mediakit` | Demo que usa checkout hosted + webhook assinado |

## Pacotes

| Pacote | Estado atual |
|--------|--------------|
| `packages/core` | Domínio e casos de uso reais do sistema |
| `packages/database` | Prisma schema, migrations e cliente |
| `packages/infrastructure` | Repositórios compartilhados + `UnitOfWork` + criptografia; não centraliza toda a infra do sistema |

## Infra

- PostgreSQL local via Docker Compose
- Redis local via Docker Compose
- BullMQ sobre Redis
- API base atual: `/api/v1`
- Store/account: toda store deve ter uma account; a migration `20260510000100_backfill_store_accounts` corrige stores antigas sem account
- Checkout local: default de `NEXT_PUBLIC_API_URL` aponta para `http://localhost:3000/api/v1`
- Study case P0 atual: `apps/demo-mediakit`, com checkout hospedado e webhook assinado
- Sem LocalStack/SQS configurado

## Known Non-P0

- Products e PaymentItems existem no schema, mas nao fazem parte do fluxo P0 validado.
- Withdrawals existem no modelo, mas ficam fora desta etapa.
- Marketplace, split de pagamento e multi-seller ficam fora desta etapa.

## Divergências importantes

- docs antigas falavam em apps separados de `dashboard` e `landing`; o estado atual usa `apps/web`
- docs antigas falavam em SQS/LocalStack; o estado atual usa BullMQ/Redis
- docs antigas usavam `/v1/...`; o estado atual usa `/api/v1/...`
- schema contém `Product`, `PaymentItem` e `Withdrawal`, mas essas áreas não têm a mesma maturidade runtime de `Payment`, `Webhook` e `CheckoutSession`
