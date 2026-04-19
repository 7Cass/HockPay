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
- Sem LocalStack/SQS configurado

## Divergências importantes

- docs antigas falavam em apps separados de `dashboard` e `landing`; o estado atual usa `apps/web`
- docs antigas falavam em SQS/LocalStack; o estado atual usa BullMQ/Redis
- docs antigas usavam `/v1/...`; o estado atual usa `/api/v1/...`
- schema contém `Product`, `PaymentItem` e `Withdrawal`, mas essas áreas não têm a mesma maturidade runtime de `Payment`, `Webhook` e `CheckoutSession`
