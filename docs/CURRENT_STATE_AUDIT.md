# Hockpay — Current State Audit

Resumo curto e auditado do estado atual do repositório.

## Apps

| App                  | Estado atual                                                                                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`           | API NestJS em `/api/v1`, com auth por cookie JWT para dashboard, API key para integrações, payments, checkout sessions, webhooks, dashboard, refunds, receipts, idempotência e `X-Request-ID` |
| `apps/worker`        | Worker NestJS com Redis/BullMQ, dispatcher de outbox resiliente, entrega de webhooks, expiração, settlement, alertas e guard in-process para cron jobs                                        |
| `apps/web`           | Angular único para landing, auth e dashboard; já expõe webhooks com filtros de delivery e IDs operacionais                                                                                    |
| `apps/checkout`      | Next.js para checkout hospedado baseado em token                                                                                                                                              |
| `apps/demo-mediakit` | Demo que usa checkout hosted + webhook assinado                                                                                                                                               |

## Pacotes

| Pacote                    | Estado atual                                                                                                                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`           | Domínio e casos de uso reais do sistema                                                                                                                                                                   |
| `packages/database`       | Prisma schema, migrations e cliente                                                                                                                                                                       |
| `packages/infrastructure` | Infra compartilhada estável: repositórios Prisma, `UnitOfWork`, criptografia, HMAC, webhook HTTP client, Discord alert sender e `ExpirationQueue`; controllers, processors e cron jobs continuam nas apps |

## Infra

- PostgreSQL local via Docker Compose
- Redis local via Docker Compose
- BullMQ sobre Redis
- API base local atual: `http://localhost:3000/api/v1`
- PostgreSQL e Redis são obrigatórios para o fluxo completo local
- Store/account: toda store deve ter uma account; a migration `20260510000100_backfill_store_accounts` corrige stores antigas sem account
- Checkout local: default de `NEXT_PUBLIC_API_URL` aponta para `http://localhost:3000/api/v1`
- Study case P0 validado: `apps/demo-mediakit`, com checkout hospedado e webhook assinado
- Smoke local validado por `pnpm run smoke:p0`
- Smoke de Payment Link disponivel por `pnpm run smoke:payment-link`
- Webhooks locais aceitam HTTP somente em `localhost`/`127.0.0.1` em ambiente local/desenvolvimento; destinos remotos exigem HTTPS público e a política bloqueia loopback, RFC1918, link-local, metadata `169.254.169.254`, IPv6 local/link-local/unique-local e protocolos não HTTP(S) na configuração e no envio
- Sem LocalStack/SQS configurado

## Estado das P's

| Prioridade | Estado atual                                                                             |
| ---------- | ---------------------------------------------------------------------------------------- |
| P0         | Done: baseline demoável e smoke local                                                    |
| P1         | Done: consistência financeira, outbox e webhook resiliente                               |
| P2         | Done: observabilidade, DX operacional, request tracing, cron guard e infra compartilhada |
| P3         | Pending: readiness de produto e preparação do próximo study-case                         |
| P4         | Pós-gate: expansões maiores de produto                                                   |

## Capacidades verificadas

- Payment direto e checkout hosted criam outbox junto do fluxo principal.
- Confirmação, expiração, falha, refund e release têm caminho de outbox para webhook.
- Webhook delivery persiste `requestId`, `outboxEventId`, `deliveryId` e `paymentId`.
- Dashboard já permite investigar entregas de webhook sem consulta direta ao banco.
- Payment Link segue o modelo `PaymentLink -> PixCharge -> Payment attempts`: o link e a PixCharge representam a cobranca comercial principal; cada falha ou pagamento gera um `Payment` como tentativa numerada; falha nao fecha o link nem a PixCharge, confirmacao fecha a PixCharge como `PAID`.
- Account, receipt e transaction existem, mas ainda precisam de melhor caminho visual de validação em P3.
- O próximo gate prático é P3: timeline de payment, validação financeira no dashboard, template de study-case e revisão de placeholders.

## Known Non-P0 / P4

- Products e PaymentItems existem no schema, mas nao fazem parte do fluxo P0 validado.
- Withdrawals existem no modelo, mas ainda não são fluxo financeiro completo validado.
- Marketplace, split de pagamento e multi-seller ficam fora do gate P1-P3 e exigem PRD próprio.
- Essas áreas não devem aparecer como prontas na documentação principal ou no dashboard até maturarem em P4.

## Divergências importantes

- docs antigas falavam em apps separados de `dashboard` e `landing`; o estado atual usa `apps/web`
- docs antigas falavam em SQS/LocalStack; o estado atual usa BullMQ/Redis
- docs antigas usavam `/v1/...`; o estado atual usa `/api/v1/...`
- schema contém `Product`, `PaymentItem` e `Withdrawal`, mas essas áreas não têm a mesma maturidade runtime de `Payment`, `Webhook`, `Receipt`, `Refund` e `CheckoutSession`
