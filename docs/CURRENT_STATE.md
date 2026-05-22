# Hockpay - Estado Atual

Este documento e a fonte canonica do runtime atual. Ele descreve o que pode ser verificado no codigo, nos scripts e nas rotas existentes hoje. Hockpay nao processa dinheiro real: pagamentos, Pix, Payment Links e saques sao simulados para desenvolvimento, demonstracao e testes locais.

## Topologia

| Area | Estado atual |
| --- | --- |
| `apps/api` | API NestJS em `http://localhost:3000/api/v1`, com cookie JWT para dashboard, API keys para integracoes e `CombinedAuthGuard` nos endpoints que aceitam os dois modos. |
| `apps/worker` | Worker NestJS separado com BullMQ/Redis, dispatcher de outbox, entrega de webhooks, alertas, expiracao, settlement, saques simulados e limpezas periodicas. |
| `apps/web` | Angular unico para landing, auth e dashboard do merchant. Inclui overview, payments, Payment Links, receipts, customers, API keys, webhooks, alerts, financials, withdrawals, products placeholder e settings parcial. |
| `apps/checkout` | Checkout Next.js para comprador, com fluxo de checkout session e rota publica de Payment Link em `/pay/:token`. |
| `apps/demo-mediakit` | Study-case de referencia com checkout hospedado e webhook assinado. |
| `packages/core` | Dominio, entidades, erros, portas, services e use cases compartilhados. |
| `packages/database` | Schema Prisma, migrations e cliente compartilhado. |
| `packages/infrastructure` | Repositorios Prisma, `UnitOfWork`, criptografia, HMAC, HTTP client de webhook, alert sender e fila de expiracao. |

## Matriz de Maturidade

| Capacidade | Status | Observacoes |
| --- | --- | --- |
| Auth, merchant, stores e API keys | Implementado | Login, refresh/logout, troca de store, cadastro de merchant, store auto-aprovada no MVP e API keys TEST/LIVE. |
| Store/account | Implementado | Toda store criada pela API nasce com `Account`; migration cobre stores antigas sem account. |
| Payments Pix simulados | Implementado | `POST /api/v1/payments` cria `PixCharge`, `Payment`, outbox e job de expiracao; exige `Idempotency-Key`. |
| Metodos card/boleto/debito | Modelado/parcial | O enum/schema aceita `CREDIT_CARD`, `BOLETO` e `DEBIT_CARD`, mas nao ha processador, adquirente ou fluxo real para esses metodos. |
| Dev simulation | Implementado | Endpoints TEST para confirmar, falhar, expirar e liberar pagamentos. |
| Checkout session | Implementado | API cria sessao, checkout coleta pagador, `fulfill` gera/submete pagamento simulado. |
| Payment Link | Implementado | Modelo `PaymentLink -> PixCharge -> Payment attempts`; falhas criam tentativas sem fechar a cobranca, pagamento fecha como `PAID`. |
| Webhooks | Implementado | Outbox, BullMQ, HMAC, logs, retry e DLQ para falhas finais. |
| Alerts | Implementado | Configs e entregas para Discord operacional com logs e retry. |
| Receipts | Implementado | Recibo emitido para pagamento confirmado, consultavel por API e dashboard. |
| Refunds | Implementado | Estornos parciais ou totais ajustam financeiro e outbox. |
| Financials | Implementado | Dashboard e API exibem account, saldos `pending/available/blocked` e transactions read-only. |
| Bank accounts | Implementado | API e dashboard para cadastro, listagem, default e remocao com regra de titularidade/documento. |
| Withdrawals | Implementado | API, dashboard list/detail, summary, filtros, timeline, ledger, worker simulado, acoes TEST e smoke dedicado. |
| Customer history | Implementado | Endpoints de historico por customer external id para pagamentos e receipts. |
| Products/catalog | Placeholder/parcial | `Product` e `PaymentItem` existem no schema; dashboard tem tela placeholder; backend/end-to-end de catalogo nao esta consolidado. |
| Settings | Parcial/read-only | Tela existe, mas nao deve ser tratada como painel completo de configuracao mutavel. |
| Marketplace/split/multi-seller | Fora do escopo atual | Requer PRD e modelagem proprios antes de aparecer como produto pronto. |

## Fluxos Reais

### Pagamento Direto

1. Integrador cria pagamento em `POST /api/v1/payments` com API key e `Idempotency-Key`.
2. API valida store, resolve/cria customer, calcula taxa, cria `PixCharge` e `Payment` simulados.
3. API grava `OutboxEvent` e agenda expiracao.
4. Em TEST, `POST /api/v1/dev/simulate/:id/confirm|fail|expire|release` simula transicoes.
5. Worker entrega webhooks e atualiza logs por BullMQ/Redis.

### Payment Link

1. Merchant cria link autenticado em `POST /api/v1/payment-links`.
2. Comprador abre `apps/checkout` em `/pay/:token`, que consulta `GET /api/v1/payment-links/public/:token`.
3. Acoes publicas TEST de `pay` e `fail` criam tentativas `Payment`.
4. Falha nao encerra o link; pagamento confirmado marca a `PixCharge` como `PAID`.

### Checkout Session

1. Integrador cria `checkout session`.
2. Comprador abre o checkout por token, informa dados minimos e chama `fulfill`.
3. A API cria/submete pagamento simulado e o checkout acompanha status.

### Withdrawals

1. Merchant cadastra conta Pix em `POST /api/v1/bank-accounts`; a titularidade usa o documento do merchant.
2. `POST /api/v1/withdrawals` exige conta verificada, saldo disponivel, auth via JWT/API key e `Idempotency-Key`; API keys ainda nao possuem scopes granulares.
3. Criacao reserva saldo `available -> blocked`, registra `WITHDRAWAL_RESERVED` e emite `withdrawal.created`.
4. Worker processa `PENDING -> PROCESSING -> COMPLETED` por padrao, com retry tecnico.
5. Sucesso deduz bloqueado, registra `WITHDRAWAL_SENT` e emite `withdrawal.completed`.
6. Falha devolve bloqueado para disponivel, registra `WITHDRAWAL_REVERSED` e emite `withdrawal.failed`.
7. Dashboard `/dashboard/withdrawals` mostra listagem, filtros, summary, criacao de saques e gestao de destinos; `/dashboard/withdrawals/:id` mostra timeline, transacoes e acoes TEST.

## Infraestrutura

- PostgreSQL e Redis sao obrigatorios para o fluxo local completo.
- BullMQ/Redis e o baseline atual de filas.
- API sem worker cria dados e outbox, mas nao entrega webhooks nem processa jobs assincronos.
- O checkout local assume `NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1`.
- Webhooks HTTP locais sao permitidos apenas para `localhost`/`127.0.0.1`; destinos remotos precisam ser HTTPS publico e passam pela politica de bloqueio de redes internas.
- `smoke:docker` sobe apenas Postgres/Redis em Docker; API, worker e checkout rodam como processos Node no host.

## CI e Smokes

CI em GitHub Actions usa Node 22 e pnpm 9.15.0. Ele roda build, testes focados de core/infrastructure/api/worker e API e2e. Nao roda lint nem smokes.

Smokes locais disponiveis:

- `pnpm run smoke:p0`
- `pnpm run smoke:payment-link`
- `pnpm run smoke:p3:visual`
- `pnpm run smoke:studycase:mediakit`
- `pnpm run smoke:system`
- `pnpm run smoke:withdrawals`
- `pnpm run smoke:docker`

O default real de `smoke:docker` e `p0,payment-link,p3,studycase,system,withdrawals`.

## Gaps e Limites

- Nao ha adquirencia real, payout real, liquidacao bancaria real ou Pix real.
- Payment Links e withdrawals sao funcionais como produto de simulacao, nao como dinheiro real.
- Card, boleto e debito existem como modelagem/campos, sem processador real.
- Products e PaymentItems ainda nao sao uma feature pronta.
- Settings nao e painel administrativo completo.
- Marketplace, split e multi-seller continuam fora do escopo atual.
