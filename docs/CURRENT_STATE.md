# Hockpay - Estado Atual

Este documento e a fonte canonica do runtime atual. Ele descreve o que pode ser verificado no codigo, nos scripts e nas rotas existentes hoje. Hockpay nao processa dinheiro real: pagamentos, Pix, Payment Links e saques sao simulados para desenvolvimento, demonstracao e testes locais.

## Topologia

| Area                      | Estado atual                                                                                                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`                | API NestJS em `http://localhost:3000/api/v1`, com cookie JWT para dashboard, API keys para integracoes e `CombinedAuthGuard` nos endpoints que aceitam os dois modos. `/api/v1/operator` autentica outro principal, com cookie e segredo proprios. |
| `apps/worker`             | Worker NestJS separado com BullMQ/Redis, dispatcher de outbox, entrega de webhooks, alertas, expiracao, settlement, saques simulados e limpezas periodicas.                                                |
| `apps/web`                | Angular unico para landing, auth, dashboard do merchant e mesa de operador. O dashboard tem overview, payments, Payment Links, products, receipts, customers, API keys, webhooks, alerts, financials, withdrawals e settings de perfil (`name`, `city`), com seletor TEST/LIVE na topbar. A mesa vive sob `/operator`, com guard, layout e sessao proprios: fila, decisao, condicao comercial, trilha e investigacao de loja. O admin tem design system proprio em `app/admin/ui` (tokens em `admin.css`, tema claro/escuro, densidade e paleta de comandos) e nao usa biblioteca de UI de terceiro. |
| `apps/checkout`           | Checkout Next.js para comprador, com fluxo de checkout session e rota publica de Payment Link em `/pay/:token`.                                                                                            |
| `apps/demo-mediakit`      | Study-case de referencia com checkout hospedado e webhook assinado.                                                                                                                                        |
| `packages/core`           | Dominio, entidades, erros, portas, services e use cases compartilhados.                                                                                                                                    |
| `packages/database`       | Schema Prisma, migrations e cliente compartilhado.                                                                                                                                                         |
| `packages/infrastructure` | Repositorios Prisma, `UnitOfWork`, criptografia, HMAC, HTTP client de webhook, alert sender e fila de expiracao.                                                                                           |

## Matriz de Maturidade

| Capacidade                        | Status               | Observacoes                                                                                                                                          |
| --------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth, merchant, stores e API keys | Implementado         | Login, refresh/logout, troca de store, troca de ambiente, cadastro de merchant e API keys TEST/LIVE. Store nasce operando em TEST sem aprovacao; `isApproved` nao existe mais. O token de dashboard carrega audiencia `merchant` e o ambiente da sessao; token de outra audiencia (ou sem audiencia) e recusado na entrada. |
| Store/account                     | Implementado         | Toda store nasce com duas `Account`, uma por ambiente (`storeId + environment`); migration cobre stores antigas.                                     |
| Payments Pix simulados            | Implementado         | `POST /api/v1/payments` cria `PixCharge`, `Payment`, outbox e job de expiracao; exige `Idempotency-Key`.                                             |
| Metodos card/boleto/debito        | Modelado/parcial     | O enum/schema aceita `CREDIT_CARD`, `BOLETO` e `DEBIT_CARD`, mas nao ha processador, adquirente ou fluxo real para esses metodos.                    |
| Dev simulation                    | Implementado         | Endpoints de simulacao para confirmar, falhar, expirar e liberar pagamentos, e para completar/falhar saque. Em LIVE eles exigem loja habilitada; em TEST, nao.                                                                                 |
| Checkout session                  | Implementado         | API cria sessao, checkout coleta pagador, `fulfill` gera/submete pagamento simulado.                                                                 |
| Payment Link                      | Implementado         | Modelo `PaymentLink -> PixCharge -> Payment attempts`, por valor avulso ou por itens do catalogo; falhas criam tentativas sem fechar a cobranca, pagamento confirmado fecha o link como `PAID`. |
| Webhooks                          | Implementado         | Outbox, BullMQ, HMAC, logs, retry e DLQ para falhas finais. Envelope versionado por tipo, catalogado em [EVENTS.md](EVENTS.md). Circuit breaker por destino no Redis e entrega concorrente. |
| Alerts                            | Implementado         | Configs e entregas para Discord operacional com logs e retry.                                                                                        |
| Receipts                          | Implementado         | Recibo emitido para pagamento confirmado, consultavel por API e dashboard.                                                                           |
| Refunds                           | Implementado         | Estornos parciais ou totais ajustam financeiro e outbox.                                                                                             |
| Financials                        | Implementado         | Dashboard e API exibem account, saldos `pending/available/blocked` e transactions read-only, sempre do ledger do ambiente da request -- que agora pode ser LIVE. |
| Bank accounts                     | Implementado         | API e dashboard para cadastro, listagem, default e remocao com regra de titularidade/documento.                                                      |
| Withdrawals                       | Implementado         | API, dashboard list/detail, summary, filtros, timeline, ledger, worker simulado, acoes de simulacao e smoke dedicado. Saque segue o ambiente da sessao: em LIVE, a reserva sai do ledger LIVE. |
| Customer history                  | Implementado         | Endpoints de historico por customer external id para pagamentos e receipts.                                                                          |
| Products/catalog                  | Implementado         | Catalogo opcional por store e environment, CRUD no dashboard/API, itens em checkout sessions e snapshots em `PaymentItem`.                           |
| Settings                          | Perfil mutavel       | Merchant edita `name` e `city` (EMV) e pede habilitacao LIVE. Fee, fixo e prazo continuam imutaveis **pelo merchant**: quem muda e a mesa.           |
| Antifraude                        | Planejado            | Nao existe. O `DetectAnomaliesUseCase` stub e o cron horario foram removidos: devolviam lista vazia e logavam varredura que nunca aconteceu. Os quatro tipos de anomalia previstos (volume, transacoes rapidas, valor atipico, taxa de falha) sao consultas sobre dados que ja estao no banco, mas nada disso esta implementado. |
| Superficie de operador            | Implementado         | Fronteira, trilha, tela e **quatro poderes**: habilitar loja para LIVE, mudar condicao comercial, ler dado de loja para investigar e mover dinheiro pela loja (saque e estorno, por chamado, sem tela ainda). Principal `Operator` com tabela, cookie e segredo proprios, sessao, `/operator/me`, trilha append-only e `/operator/stores` (fila, decisao, condicao comercial e as cinco leituras). A mesa tem tela propria em `apps/web` sob `/operator`. Sem papeis dentro do operador, sem impersonacao e sem fila de revisao antifraude. |
| Habilitacao LIVE de loja          | Implementado         | `Store.liveStatus` com cinco estados. TEST funciona em todos; LIVE exige `APPROVED`. Lojista pede em Settings, a mesa decide, e toda decisao grava linha na trilha na mesma transacao. |
| Condicao comercial                | Implementado         | `Store.updateCommercialTerms` move `feePercent`, `feeFixed` e `settlementDays` **juntos**, com faixa validada no dominio (0-10%, 0-1000 centavos, 0-90 dias) e `INVALID_COMMERCIAL_TERMS` fora dela. Escrita so por `POST /operator/stores/:id/commercial-terms`, com motivo obrigatorio e `before`/`after` na trilha. Vale para cobranca futura: `Payment.fee` continua snapshot. |
| Ambiente da sessao                | Implementado         | `Merchant.currentEnvironment` decide o ambiente da sessao de dashboard, e o token carrega a copia. `POST /auth/switch-environment` troca, com o gate de habilitacao no use case; login e refresh reconferem e rebaixam para TEST se a loja perdeu a habilitacao. Seletor na topbar, com LIVE sempre rotulado como simulado. |
| Marketplace/split/multi-seller    | Fora do escopo atual | Requer PRD e modelagem proprios antes de aparecer como produto pronto.                                                                               |

## Matriz de Superficies

| Feature           | Controller/API               | Schema                                                      | Dashboard/Checkout                               | Smoke                                                          | Limites atuais                                                           |
| ----------------- | ---------------------------- | ----------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Payments Pix      | `payment`, `dev`             | `Payment`, `PixCharge`, `PaymentItem`                       | dashboard payments/detail e checkout status      | `smoke:p0`, `smoke:system`                                     | Pix simulado; card/boleto/debito sem processador real.                   |
| Payment Links     | `payment-link`               | `PaymentLink`, `PaymentLinkItem`, `PixCharge`, `Payment`    | dashboard Payment Links e checkout `/pay/:token` | `smoke:payment-link`                                           | Exige exatamente um de `amount` ou `items`; quantidade fixa na criacao; `payment_link.expired` depende de haver uma tentativa que expire. |
| Checkout sessions | `checkout-session`           | `CheckoutSession`, `CheckoutSessionItem`, `PaymentItem`     | checkout hosted e demo Media Kit                 | `smoke:studycase:mediakit`                                     | Exige exatamente um de `amount` ou `items`; metadata publica e limitada. |
| Products/catalog  | `product`                    | `Product`, snapshots em `CheckoutSessionItem`/`PaymentLinkItem`/`PaymentItem` | dashboard Products, checkout sessions e Payment Links com items | coberto por testes/builds focados e por `smoke:payment-link`    | Catalogo opcional por store/environment.                                 |
| Webhooks/alerts   | `webhook`, `alert`           | `OutboxEvent`, `WebhookLog`, `AlertDeliveryLog`             | dashboard webhooks/alerts                        | `smoke:system`, `smoke:payment-link`                           | Entrega depende do worker/Redis e politica de URL.                       |
| Operador          | `operator-auth`, `operator`, `operator-store`, `operator-store-read` | `Operator`, `OperatorRefreshToken`, `OperatorAuditLog`, `Store.liveStatus`, `Store.feePercent`/`feeFixed`/`settlementDays` | mesa em `/operator` (fila, detalhe de loja, condicao comercial, investigacao e trilha); lojista pede LIVE em Settings | coberto por unit tests e pelo e2e da API; sem smoke dedicado | Tres poderes: habilitar LIVE, condicao comercial e leitura para investigar. Sem papeis, sem impersonacao e sem antifraude; fila e trilha paginam por `offset`/`limit` e nao devolvem total; provisionamento por `pnpm operator:create`. |
| Ambiente da sessao | `auth`, `merchant`            | `Merchant.currentEnvironment`                               | seletor TEST/LIVE na topbar do dashboard          | coberto por unit tests, pelo e2e da API e pelos testes do dashboard | Selecionar LIVE exige `liveStatus = APPROVED`; a troca revoga a sessao anterior e recarrega o dashboard. |
| Withdrawals       | `withdrawal`, `bank-account` | `Withdrawal`, `BankAccount`, `Transaction`                  | dashboard withdrawals/list/detail                | `smoke:withdrawals`                                            | Saque simulado; sem payout bancario real. Em LIVE, simular exige loja habilitada. |

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

### Habilitacao LIVE

1. Toda loja nasce em `liveStatus = NOT_REQUESTED` e cobra em TEST sem aprovacao nenhuma.
2. `POST /api/v1/stores/:id/live-request` move `NOT_REQUESTED | REJECTED -> PENDING`. O lojista ve o estado, a razao da ultima decisao e o botao de pedido em `/dashboard/settings`.
3. `GET /api/v1/operator/stores?liveStatus=PENDING` e a fila da mesa. Ela devolve so id, merchant, nome, slug, estado, razao e datas -- sem ledger, sem pagamento e sem credencial.
4. `POST /api/v1/operator/stores/:id/live-status` decide (`approve`, `reject`, `suspend`) com `reason` obrigatorio, validado no use case. A linha da trilha (`store.live_approved|rejected|suspended`, com `before`, `after`, `reason` e `requestId`) e escrita na mesma transacao da mudanca.
5. Transicoes validas: lojista `NOT_REQUESTED|REJECTED -> PENDING`; mesa `PENDING -> APPROVED|REJECTED`, `APPROVED -> SUSPENDED` e `SUSPENDED -> APPROVED`. Qualquer outra e `INVALID_STORE_LIVE_STATUS_TRANSITION`.
6. Loja `APPROVED` cobra, confirma e acumula saldo em LIVE. **LIVE tambem e simulado**: o que a habilitacao separa e permissao e cerimonia, nao mecanica.
7. **A habilitacao fecha os dois sentidos do dinheiro.** Entrada (`POST /payments`, `/payment-links`, `/checkout-sessions`) e saida (`POST /withdrawals`, `POST /refunds`) releem a loja na chamada e recusam LIVE com `STORE_LIVE_NOT_ENABLED` fora de `APPROVED`. Reler **na chamada** e o que faz a suspensao valer: nada revoga um access token em voo, entao confiar no token deixaria a loja operando ate o proximo refresh.
8. O caminho do sistema nao passa pelo gate. Liquidacao, expiracao e o fechamento de saque (`complete`/`fail`/`mark-processing`) movem dinheiro que a loja ja criou legitimamente; fecha-los deixaria saldo LIVE preso em `pending` ou `blocked` para sempre.

### Condicao comercial

1. `POST /api/v1/operator/stores/:id/commercial-terms` recebe `feePercent`, `feeFixed`, `settlementDays` e `reason` obrigatorio.
2. `Store.updateCommercialTerms` valida os tres no dominio (0-10%, 0-1000 centavos, 0-90 dias) e move os tres **juntos**. Nao existe mudanca parcial; fora de faixa e `INVALID_COMMERCIAL_TERMS`.
3. A linha `store.commercial_terms_changed`, com `before`/`after` dos tres valores e o motivo, e escrita na mesma transacao.
4. A mudanca vale para cobranca futura. `Payment.fee` e snapshot do momento da cobranca e nao e recalculado.
5. O lojista continua vendo os tres em `GET /api/v1/stores`; ele nunca deixou de saber o que paga.

### Investigacao de loja

1. `GET /api/v1/operator/stores/:id` e a entrada, e a unica leitura da mesa que escreve: ela grava `store.investigated` na trilha. Quem abriu a loja abriu a loja, inclusive quem so foi mexer na taxa.
2. As sub-leituras (`/payments`, `/payments/:paymentId/timeline`, `/account`, `/transactions`, `/webhooks`, `/webhooks/logs`) sao puras e reusam os use cases do merchant, com o `storeId` vindo da rota.
3. As rotas com escopo de ambiente exigem `environment` explicito na query, sem default: investigar producao e receber o ledger TEST em silencio produz a conclusao errada com dado certo.
4. Nao ha rota de chave de API, e webhook config sai por `toPublicObject()` -- com o prefixo, sem o secret. `operator-read-no-secrets.spec.ts` varre as rotas do modulo por reflexao e falha se isso mudar.

### Troca de ambiente do dashboard

1. `Merchant.currentEnvironment` guarda o ambiente da sessao, ao lado de `currentStoreId`; o access token carrega a copia.
2. `POST /api/v1/auth/switch-environment` valida, persiste no merchant, revoga os refresh tokens e re-emite o par -- a mesma ordem de `switch-store`.
3. Selecionar LIVE exige `store.liveStatus = APPROVED`, checado no use case. TEST nunca e recusado, em nenhum dos cinco estados.
4. Login e refresh reconferem a habilitacao e **rebaixam para TEST** se a loja perdeu o LIVE, em vez de falhar: `currentEnvironment` sobrevive ao logout, e uma loja suspensa nao pode reentrar em LIVE pela porta dos fundos.
5. Trocar de store e criar store resetam a sessao para TEST: a loja nova nunca esta habilitada, e a antiga nao responde pela nova.
6. O dashboard recarrega inteiro na troca. Nenhuma tela filtra os dois ledgers no cliente.

### Withdrawals

1. Merchant cadastra conta Pix em `POST /api/v1/bank-accounts`; a titularidade usa o documento do merchant.
2. `POST /api/v1/withdrawals` exige conta verificada, saldo disponivel, sessao JWT do dashboard e `Idempotency-Key`. API keys nao criam saque. Mutacoes de destino Pix (`POST`/`PATCH`/`DELETE` bank-accounts) e `POST /refunds` tambem sao JWT-only.
3. Criacao reserva saldo `available -> blocked`, registra `WITHDRAWAL_RESERVED` e emite `withdrawal.created`.
4. Worker processa `PENDING -> PROCESSING -> COMPLETED` por padrao, com retry tecnico.
5. Sucesso deduz bloqueado, registra `WITHDRAWAL_SENT` e emite `withdrawal.completed`.
6. Falha devolve bloqueado para disponivel, registra `WITHDRAWAL_REVERSED` e emite `withdrawal.failed`.
7. Dashboard `/dashboard/withdrawals` mostra listagem, filtros, summary, criacao de saques e gestao de destinos; `/dashboard/withdrawals/:id` mostra timeline, transacoes e acoes TEST.
8. Loja sem habilitacao LIVE nao saca nem estorna por conta propria. A saida do saldo dela e a mesa, por chamado: `POST /api/v1/operator/stores/:id/withdrawals` e `POST /api/v1/operator/stores/:id/refunds`, com `Idempotency-Key` obrigatorio, `environment` explicito e `reason` obrigatorio. As duas gravam linha na trilha (`store.withdrawal_created`, `store.refund_created`) na mesma transacao do movimento, com o estado dos dois lados.

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

## Principais e fronteira de autorizacao

Existem dois principais, e eles nao se cruzam:

| Principal | Entra por                                         | Token                                                                 |
| --------- | -------------------------------------------------- | --------------------------------------------------------------------- |
| Merchant  | cookie `hockpay_at` (dashboard) ou API key `hk_*` | JWT audiencia `merchant`, assinado com `JWT_SECRET`                   |
| Operador  | cookie `hockpay_op_at`, so em `/api/v1/operator`  | JWT audiencia `operator`, assinado com `OPERATOR_JWT_SECRET`          |

- Segredos diferentes: um token de merchant nao verifica numa rota de operador nem se a checagem de audiencia falhar, e vice-versa. Token sem audiencia nao vale para nenhum dos dois.
- API key nunca autentica operador, em TEST ou em LIVE. Nao existe API key de operador.
- `@OperatorRoute()` tira a rota do guard global de merchant e instala o `OperatorAuthGuard` na mesma marca; um teste de varredura falha se um controller do modulo sair dessa forma.
- Nao existe elevacao de merchant para operador nem impersonacao. Operador se cria por `pnpm operator:create` (senha por prompt/stdin), nunca por cadastro publico ou seed automatico.
- Cookies do operador tem paths proprios: `hockpay_op_at` em `/api/v1/operator` e `hockpay_op_rt` em `/api/v1/operator/auth/refresh`. Por isso o logout revoga a sessao pelo operador autenticado, nao pelo cookie de refresh (que nao chega naquela rota).
- **Logout revoga por principal nos dois lados, e as duas rotas sao autenticadas.** `hockpay_rt` tambem tem path proprio (`/api/v1/auth/refresh`) e nunca chega em `/api/v1/auth/logout`, entao um logout que lesse esse cookie leria `undefined` e nao revogaria nada -- respondendo `204` com a sessao viva no banco. Corrigido em `2026-09-08`, no molde do lado do operador.
- Trilha de auditoria (`operator_audit_logs`) e append-only: a porta nao tem update nem delete, e o repositorio so existe dentro do `UnitOfWork`, entao a linha e escrita na mesma transacao da mudanca que descreve. Hoje registra sete acoes, todas com `requestId`: `operator.login`, `operator.logout`, `store.live_approved|rejected|suspended`, `store.commercial_terms_changed` e `store.investigated`. As tres primeiras de loja e a de condicao comercial carregam `before`/`after` e o motivo. Sem retencao ou purga.

## Idempotencia

Mutacoes financeiras/comerciais exigem header `Idempotency-Key`: `POST /payments`, `POST /withdrawals`, `POST /refunds`, `POST /payment-links`, `POST /checkout-sessions`. A reserva e unica por `key + storeId + environment` (JWT = ambiente da sessao; API key = environment da key). Replay so ocorre quando a mesma chave, store, ambiente e fingerprint HTTP batem.

## Isolamento TEST/LIVE

- O ambiente da request vem de tres lugares, e nunca de um default: sessao JWT usa `Merchant.currentEnvironment` (copiado no token); API key usa o ambiente da key; rota de leitura de operador **exige** `environment` explicito na query, sem default. O `?? TEST` do guard cobre so token antigo, mintado antes do campo existir.
- Entidades com coluna `environment` (`Payment`, `PaymentLink`, `CheckoutSession`, `Product`, `ApiKey`): list/get autenticados (incluindo timeline de payment) filtram pelo environment da request.
- `Payment.externalId` e `Idempotency-Key` sao unicos por `storeId + environment`. Customer continua store-wide (sem coluna de environment).
- `Account` e unica por `storeId + environment`: cada loja tem um ledger TEST e um LIVE, e nenhuma escrita de saldo resolve conta sem informar ambiente. A porta nao tem lookup so por loja.
- Saldo, transacoes, metricas e saque do dashboard sao do ledger do ambiente da sessao. O seletor da topbar troca de ambiente re-emitindo o par de tokens; nenhuma tela filtra os dois ledgers no cliente.
- Estorno e liquidacao seguem o ambiente do pagamento, nao o da request: dinheiro volta para o ledger de onde saiu.
- `Transaction` nao tem coluna de ambiente; herda o da conta em que esta pendurada.
- Entidades sem coluna de environment (`Customer`, `WebhookConfig`, `Refund`, `BankAccount`) sao escopadas por store. `Receipt` herda `payment.environment` em list/get e no customer-history.
- `Withdrawal` grava o environment da request na criacao para recusar acao TEST sobre reserva LIVE, e a reserva sai da conta desse ambiente. A listagem continua store-wide; o ledger e o resumo dela vem da conta do ambiente da request.
- Simular ou cobrar em LIVE exige `store.liveStatus === APPROVED`; a recusa e `STORE_LIVE_NOT_ENABLED` (422). Vale para `/dev/simulate/:id/*`, pay/fail de Payment Link, `fulfill` de checkout e para a criacao de payment, Payment Link e checkout session.
- **Excecao, e a unica:** os caminhos do proprio sistema -- `SettlementJob` e a fila/job de expiracao -- passam `systemInitiated: true` e nao consultam habilitacao. Bloquea-los prenderia dinheiro LIVE em `pending` para sempre quando a mesa suspende uma loja.
- Sessao/key TEST nao confirma, expira, falha, libera, estorna payment LIVE nem cancela Payment Link LIVE, e o contrario tambem nao vale: o ambiente do chamador precisa ser o do agregado, e a recusa e `LIVE_ENVIRONMENT_NOT_ALLOWED`. Habilitar LIVE nao dissolveu esse isolamento, e o seletor de ambiente tambem nao.
- Simular em LIVE segue a mesma regra de cobrar em LIVE, inclusive nas acoes de saque: a loja precisa estar `APPROVED`, e a recusa e `STORE_LIVE_NOT_ENABLED`. Nao existe uma segunda resposta para "posso simular em LIVE?".
- Key TEST simula no ledger TEST da store e nao encosta no LIVE; key LIVE de loja habilitada simula no ledger LIVE e nao encosta no TEST. Create de saque, refund e destino Pix continua JWT-only, mas JWT deixou de significar TEST: em sessao LIVE, os tres alcancam o ledger LIVE.
- A leitura de operador nao afrouxa nada disso: ela reusa os mesmos use cases do merchant, com o `storeId` vindo da rota e o `environment` vindo da query.

## Gaps e Limites

- Nao ha adquirencia real, payout real, liquidacao bancaria real ou Pix real.
- Payment Links e withdrawals sao funcionais como produto de simulacao, nao como dinheiro real.
- Card, boleto e debito existem como modelagem/campos, sem processador real.
- Settings edita so perfil (`name`, `city`). Fee, fixo e prazo nao sao mutaveis pelo merchant -- e decisao, nao lacuna: quem muda condicao comercial e a mesa, com motivo e trilha.
- Marketplace, split e multi-seller continuam fora do escopo atual.
- Suspender uma loja nao revoga a sessao do lojista. `DecideLiveEnablementUseCase` nao mexe em token nem em `currentEnvironment`; quem rebaixa e o proximo login ou refresh. A janela e o TTL do access token -- mas desde `2026-09-09` ela nao custa mais dinheiro: a sessao sobrevive, e nao move nada, porque todo caminho que move dinheiro rele a loja.
- **A via da mesa nao tem tela.** As duas rotas de movimentacao existem e sao operaveis por HTTP, mas nao ha superficie em `apps/web` para o operador sacar ou estornar por chamado. Ate ela existir, um chamado de retirada de loja suspensa se resolve por `curl` -- exatamente onde a mesa inteira estava antes da passagem de `2026-09-08`.
- As duas rotas de operador que fazem parse de paginacao a mao (fila e trilha) aceitam `?limit=abc`: `Number('abc')` e `NaN`, o `?? DEFAULT_LIMIT` nao pega `NaN` e o clamp o preserva. As rotas de leitura novas nao tem o problema, porque usam `class-validator`.
- A mesa nao tem papeis internos: todo operador pode tudo que a mesa pode. Sem impersonacao, sem MFA.
- Antifraude nao existe, e por ordem: o PRD da superficie de operador poe o motor **depois** da fila de revisao, e ela nao existe.
- Fila e trilha paginam por `offset`/`limit` e nao devolvem contagem, entao a mesa anda por "anterior/proxima" e nao por numero de pagina.
- Trilha de operador cresce sem retencao.
- Nao ha smoke dedicado da mesa nem do seletor de ambiente. As duas trilhas sao cobertas por unit test, pelo e2e da API e por teste de tela contra HTTP mockado -- nenhuma das duas foi exercitada ponta a ponta contra a API de verdade ainda.
- **LIVE tambem e simulado.** A habilitacao decide quem pode operar em producao, nao de onde vem o dinheiro: nao ha adquirente, e nenhum centavo e real em nenhum dos dois ambientes. As telas de saldo e de chaves dizem isso.
- O ambiente e por sessao, e nao por aba: o cookie e do browser inteiro, entao trocar numa aba move todas. As abas ja renderizadas seguem mostrando o ambiente anterior ate recarregarem.
