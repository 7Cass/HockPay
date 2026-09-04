# Hockpay - Estado Atual

Este documento e a fonte canonica do runtime atual. Ele descreve o que pode ser verificado no codigo, nos scripts e nas rotas existentes hoje. Hockpay nao processa dinheiro real: pagamentos, Pix, Payment Links e saques sao simulados para desenvolvimento, demonstracao e testes locais.

## Topologia

| Area                      | Estado atual                                                                                                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`                | API NestJS em `http://localhost:3000/api/v1`, com cookie JWT para dashboard, API keys para integracoes e `CombinedAuthGuard` nos endpoints que aceitam os dois modos.                                      |
| `apps/worker`             | Worker NestJS separado com BullMQ/Redis, dispatcher de outbox, entrega de webhooks, alertas, expiracao, settlement, saques simulados e limpezas periodicas.                                                |
| `apps/web`                | Angular unico para landing, auth e dashboard do merchant. Inclui overview, payments, Payment Links, products, receipts, customers, API keys, webhooks, alerts, financials, withdrawals e settings de perfil (`name`, `city`). |
| `apps/checkout`           | Checkout Next.js para comprador, com fluxo de checkout session e rota publica de Payment Link em `/pay/:token`.                                                                                            |
| `apps/demo-mediakit`      | Study-case de referencia com checkout hospedado e webhook assinado.                                                                                                                                        |
| `packages/core`           | Dominio, entidades, erros, portas, services e use cases compartilhados.                                                                                                                                    |
| `packages/database`       | Schema Prisma, migrations e cliente compartilhado.                                                                                                                                                         |
| `packages/infrastructure` | Repositorios Prisma, `UnitOfWork`, criptografia, HMAC, HTTP client de webhook, alert sender e fila de expiracao.                                                                                           |

## Matriz de Maturidade

| Capacidade                        | Status               | Observacoes                                                                                                                                          |
| --------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth, merchant, stores e API keys | Implementado         | Login, refresh/logout, troca de store, cadastro de merchant, store auto-aprovada no MVP e API keys TEST/LIVE.                                        |
| Store/account                     | Implementado         | Toda store criada pela API nasce com `Account`; migration cobre stores antigas sem account.                                                          |
| Payments Pix simulados            | Implementado         | `POST /api/v1/payments` cria `PixCharge`, `Payment`, outbox e job de expiracao; exige `Idempotency-Key`.                                             |
| Metodos card/boleto/debito        | Modelado/parcial     | O enum/schema aceita `CREDIT_CARD`, `BOLETO` e `DEBIT_CARD`, mas nao ha processador, adquirente ou fluxo real para esses metodos.                    |
| Dev simulation                    | Implementado         | Endpoints TEST para confirmar, falhar, expirar e liberar pagamentos.                                                                                 |
| Checkout session                  | Implementado         | API cria sessao, checkout coleta pagador, `fulfill` gera/submete pagamento simulado.                                                                 |
| Payment Link                      | Implementado         | Modelo `PaymentLink -> PixCharge -> Payment attempts`, por valor avulso ou por itens do catalogo; falhas criam tentativas sem fechar a cobranca, pagamento confirmado fecha o link como `PAID`. |
| Webhooks                          | Implementado         | Outbox, BullMQ, HMAC, logs, retry e DLQ para falhas finais. Envelope versionado por tipo, catalogado em [EVENTS.md](EVENTS.md). Circuit breaker por destino no Redis e entrega concorrente. |
| Alerts                            | Implementado         | Configs e entregas para Discord operacional com logs e retry.                                                                                        |
| Receipts                          | Implementado         | Recibo emitido para pagamento confirmado, consultavel por API e dashboard.                                                                           |
| Refunds                           | Implementado         | Estornos parciais ou totais ajustam financeiro e outbox.                                                                                             |
| Financials                        | Implementado         | Dashboard e API exibem account, saldos `pending/available/blocked` e transactions read-only.                                                         |
| Bank accounts                     | Implementado         | API e dashboard para cadastro, listagem, default e remocao com regra de titularidade/documento.                                                      |
| Withdrawals                       | Implementado         | API, dashboard list/detail, summary, filtros, timeline, ledger, worker simulado, acoes TEST e smoke dedicado.                                        |
| Customer history                  | Implementado         | Endpoints de historico por customer external id para pagamentos e receipts.                                                                          |
| Products/catalog                  | Implementado         | Catalogo opcional por store e environment, CRUD no dashboard/API, itens em checkout sessions e snapshots em `PaymentItem`.                           |
| Settings                          | Perfil mutavel       | Merchant edita `name` e `city` (EMV). Fee, settlement e aprovacao continuam imutaveis.                                                               |
| Antifraude                        | Planejado            | Nao existe. O `DetectAnomaliesUseCase` stub e o cron horario foram removidos: devolviam lista vazia e logavam varredura que nunca aconteceu. Os quatro tipos de anomalia previstos (volume, transacoes rapidas, valor atipico, taxa de falha) sao consultas sobre dados que ja estao no banco, mas nada disso esta implementado. |
| Marketplace/split/multi-seller    | Fora do escopo atual | Requer PRD e modelagem proprios antes de aparecer como produto pronto.                                                                               |

## Matriz de Superficies

| Feature           | Controller/API               | Schema                                                      | Dashboard/Checkout                               | Smoke                                                          | Limites atuais                                                           |
| ----------------- | ---------------------------- | ----------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Payments Pix      | `payment`, `dev`             | `Payment`, `PixCharge`, `PaymentItem`                       | dashboard payments/detail e checkout status      | `smoke:p0`, `smoke:system`                                     | Pix simulado; card/boleto/debito sem processador real.                   |
| Payment Links     | `payment-link`               | `PaymentLink`, `PaymentLinkItem`, `PixCharge`, `Payment`    | dashboard Payment Links e checkout `/pay/:token` | `smoke:payment-link`                                           | Exige exatamente um de `amount` ou `items`; quantidade fixa na criacao; `payment_link.expired` depende de haver uma tentativa que expire. |
| Checkout sessions | `checkout-session`           | `CheckoutSession`, `CheckoutSessionItem`, `PaymentItem`     | checkout hosted e demo Media Kit                 | `smoke:studycase:mediakit`                                     | Exige exatamente um de `amount` ou `items`; metadata publica e limitada. |
| Products/catalog  | `product`                    | `Product`, snapshots em `CheckoutSessionItem`/`PaymentLinkItem`/`PaymentItem` | dashboard Products, checkout sessions e Payment Links com items | coberto por testes/builds focados e por `smoke:payment-link`    | Catalogo opcional por store/environment.                                 |
| Webhooks/alerts   | `webhook`, `alert`           | `OutboxEvent`, `WebhookLog`, `AlertDeliveryLog`             | dashboard webhooks/alerts                        | `smoke:system`, `smoke:payment-link`                           | Entrega depende do worker/Redis e politica de URL.                       |
| Withdrawals       | `withdrawal`, `bank-account` | `Withdrawal`, `BankAccount`, `Transaction`                  | dashboard withdrawals/list/detail                | `smoke:withdrawals`                                            | Saque simulado; sem payout bancario real.                                |

## Fluxos Reais

### Pagamento Direto

1. Integrador cria pagamento em `POST /api/v1/payments` com API key e `Idempotency-Key`.
2. API valida store, resolve/cria customer, calcula taxa, cria `PixCharge` e `Payment` simulados.
3. API grava `OutboxEvent` e agenda expiracao.
4. Em TEST, `POST /api/v1/dev/simulate/:id/confirm|fail|expire|release` simula transicoes.
5. Worker entrega webhooks e atualiza logs por BullMQ/Redis, com o envelope `{ id, type, version, created_at, data }`.

### Payment Link

1. Merchant cria link autenticado em `POST /api/v1/payment-links`, com exatamente um de `amount` ou `items`.
2. Comprador abre `apps/checkout` em `/pay/:token`, que consulta `GET /api/v1/payment-links/public/:token`.
3. Checkout publico `/pay/:token` coleta documento do pagador; `pay` associa um `Customer` a tentativa.
4. Acoes publicas TEST de `pay` e `fail` criam tentativas `Payment` que herdam o snapshot de items do link, quando ele tem items.
5. Falha nao encerra o link; pagamento confirmado marca a `PixCharge` como `PAID`.
6. O ciclo do link emite `payment_link.created`, `.paid`, `.expired` e `.cancelled`, alem dos `payment.*` da tentativa.

### Checkout Session

1. Integrador cria `checkout session`, com exatamente um de `amount` ou `items`.
2. Comprador abre o checkout por token, informa dados minimos e chama `fulfill`.
3. Se houver `items`, cada item referencia um produto existente da store/environment e o checkout publico mostra resumo sem metadata.
4. A API cria/submete pagamento simulado e o checkout acompanha status.

### Products

1. Merchant ou integrador cria produto em `POST /api/v1/products`.
2. Produtos sao separados por store e environment; `externalId` e unico dentro de `storeId + environment`.
3. Produtos arquivados usam `isActive=false` e nao entram em novas cobrancas.
4. Checkout sessions e Payment Links podem referenciar produtos por `productId`; o valor da cobranca vem da soma dos itens, nunca do cliente.
5. Produto referenciado gera snapshot de nome, descricao, preco, imagem, `productId` e `productExternalId`; metadata do produto nao e copiada automaticamente.

### Withdrawals

1. Merchant cadastra conta Pix em `POST /api/v1/bank-accounts`; a titularidade usa o documento do merchant.
2. `POST /api/v1/withdrawals` exige conta verificada, saldo disponivel, sessao JWT do dashboard e `Idempotency-Key`. API keys nao criam saque. Mutacoes de destino Pix (`POST`/`PATCH`/`DELETE` bank-accounts) e `POST /refunds` tambem sao JWT-only.
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

CI em GitHub Actions usa Node 22 e pnpm 9.15.0.

- Job `smoke-concurrency`: sobe a stack por Docker em todo PR. Roda `db-concurrency`, `idempotency` e `idempotency-redis-unavailable` (api-only) e `webhook-isolation` (sobe worker, nao sobe checkout).
- Job `build`: `pnpm run lint:check`, `pnpm run format:check` e `pnpm build`. Os dois cobrem `apps/api`, `apps/worker`, `packages/core`, `packages/infrastructure` e `packages/database`. `apps/web`, `apps/checkout` e `apps/demo-mediakit` nao tem `lint:check` nem `format:check` e ficam fora do gate; `apps/web` tem testes, checkout e demo nao tem nenhum.
- Job `test`: testes de `@hockpay/core`, `@hockpay/infrastructure`, `@hockpay/api` e `@hockpay/worker`.
- Job `api-e2e`: e2e da API.
- Job `web-test`: testes do dashboard Angular (`pnpm --filter @hockpay/web test -- --watch=false`).
- Job `smoke-minimal`: suite `p0,payment-link` via `smoke:docker`, apenas em `workflow_dispatch` ou cron diario. Checkout e coberto por esse smoke, nao por um job de unit test no PR.

Smokes locais disponiveis:

- `pnpm run smoke:p0`
- `pnpm run smoke:payment-link`
- `pnpm run smoke:p3:visual`
- `pnpm run smoke:studycase:mediakit`
- `pnpm run smoke:system`
- `pnpm run smoke:withdrawals`
- `pnpm run smoke:docker`

O default real de `smoke:docker` e `p0,payment-link,p3,studycase,system,withdrawals`.

## Idempotencia

Mutacoes financeiras/comerciais exigem header `Idempotency-Key`: `POST /payments`, `POST /withdrawals`, `POST /refunds`, `POST /payment-links`, `POST /checkout-sessions`. A reserva e unica por `key + storeId + environment` (JWT = TEST; API key = environment da key). Replay so ocorre quando a mesma chave, store, ambiente e fingerprint HTTP batem.

## Isolamento TEST/LIVE

- Entidades com coluna `environment` (`Payment`, `PaymentLink`, `CheckoutSession`, `Product`, `ApiKey`): list/get autenticados (incluindo timeline de payment) filtram pelo environment da request (JWT = TEST; API key = environment da key).
- `Payment.externalId` e `Idempotency-Key` sao unicos por `storeId + environment`. Customer continua store-wide (sem coluna de environment).
- `Account` continua unico por store. JWT do dashboard mostra saldo e metricas da loja inteira, nao um ledger TEST separado.
- Entidades sem coluna de environment (`Customer`, `WebhookConfig`, `Refund`, `BankAccount`) sao escopadas por store. `Receipt` herda `payment.environment` em list/get e no customer-history.
- `Withdrawal` grava o environment da request na criacao para recusar acao TEST sobre reserva LIVE; listagem continua store-wide.
- Simulacao publica de Payment Link e checkout continua recusando LIVE no use case.
- Sessao/key TEST nao confirma, expira, falha, libera, estorna payment LIVE nem cancela Payment Link LIVE.
- Key TEST ainda pode simular no saldo da store (`POST /dev/simulate/:id/*`, pay autenticado de Payment Link, `POST /dev/withdrawals/:id/complete|fail`). LIVE key nao. Create de saque, refund e destino Pix continua JWT-only.

## Gaps e Limites

- Nao ha adquirencia real, payout real, liquidacao bancaria real ou Pix real.
- Payment Links e withdrawals sao funcionais como produto de simulacao, nao como dinheiro real.
- Card, boleto e debito existem como modelagem/campos, sem processador real.
- Settings edita so perfil (`name`, `city`); fee, settlement e aprovacao nao sao mutaveis pelo merchant.
- Marketplace, split e multi-seller continuam fora do escopo atual.
