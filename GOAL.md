# Hockpay - Goal

Source repo: `/Users/jpcass/Documents/2026/hockpay`
Last reviewed: `2026-08-19`
Ordering: criticidade primeiro
Scope: isolamento de identidade TEST/LIVE (idempotencia + `externalId`) e README da API alinhado ao runtime

Este arquivo e o tracker executavel da goal atual. Cada macro item e uma unidade de planejamento; as checkboxes em `Subtasks` sao as unidades executaveis de implementacao e validacao.

As tres passagens anteriores (arquivadas em `docs/goals/`) fecharam escrita financeira, DomainError, CombinedAuth, JWT-only de saque/estorno/destino Pix, isolamento de leitura de payment/recibo/link e honestidade do workspace. Esta goal cobre o que ainda fura isolamento **na identidade** (mesma chave/id atravessa TEST e LIVE) e o contrato HTTP que o integrador copia do README da API.

## Status Legend

- `nao iniciado`
- `em planejamento`
- `em implementacao`
- `em validacao/hardening`
- `concluido`

## Priority Legend

- `P0`: risco de integridade, key TEST replaying/criando identidade LIVE, unique index cruzando ambiente.
- `P1`: corrida no unique virando 500, README/docs que mentem o contrato de authz/idempotencia.
- `P2`: acabamento de exemplo/copy que nao muda invariante.

## Intake Snapshot

- Branch da review: `main` (25 commits a frente de `origin/main` no momento da abertura).
- Fonte: review pos-tres-goals de `packages/core`, `packages/infrastructure`, `packages/database`, `apps/api` e docs canonicos.
- Docs canonicos considerados: `README.md`, `apps/api/README.md`, `docs/CURRENT_STATE.md`, `docs/PRODUCT.md`, `docs/DATA_MODEL.md`.
- Decisao de recorte: **nao** JWT-only em `/dev/simulate` nem pay autenticado de link nesta passagem — documentar como TEST-key no Account compartilhado. **Nao** abrir unicidade de Customer por environment (Customer nao tem coluna). **Nao** abrir workspace de webhook/alerta (fatia B da review).

## P0 - Identidade TEST/LIVE

### P0.1 Idempotency-Key honrar environment

Status: `concluido`

Problema: `IdempotencyKey` e unico em `(key, storeId)`. O fingerprint HTTP (method/path/body) nao inclui environment. Redis `generateIdempotencyCacheKey` tambem e `key:storeId`. JWT e TEST; `hk_live_` e LIVE. A mesma `Idempotency-Key` + mesmo body em TEST e depois LIVE **repete o payment do outro ambiente** (200 replay), em vez de criar cobranca LIVE nova.

Impacto: isolamento de escrita das goals anteriores nao cobre o cache de create. Integrador que reusa a chave entre keys da mesma store mistura ledgers no sentido de identidade (o body LIVE vira a cobranca TEST).

Evidencia:

- `packages/database/prisma/schema.prisma` (`@@unique([key, storeId])` em `IdempotencyKey`)
- `apps/api/src/common/idempotency/idempotency-fingerprint.ts` (`generateIdempotencyCacheKey` sem environment)
- `packages/infrastructure/src/repositories/idempotency-key.repository.ts` (reserve/find por key+storeId)
- Contraste: Product ja e unico em `storeId + environment + externalId`

Subtasks:

- [x] P0.1.1 Incluir `environment` na unicidade persistida e no cache Redis.
  - Problema: a reserva e store-wide.
  - Solucao: unique `(key, storeId, environment)`; fingerprint/cache key inclui environment da request. Migration + backfill: linhas existentes herdam `TEST` se nao der para inferir, ou recriar o indice depois de preencher.
  - Validacao: spec `hk_test_` cria; `hk_live_` com a mesma key+body cria payment LIVE novo (nao replay). Mesma key+body+environment continua replay.
- [x] P0.1.2 Conflito de fingerprint (mesma key, outro path/body) continua 409, agora no recorte store+environment.
  - Validacao: spec ja existente de mismatch continua; nao vaza para o outro ambiente.

Done Criteria:

- [x] Mesma `Idempotency-Key` em TEST e LIVE nao devolve o mesmo `paymentId`.
- [x] Replay so acontece quando key + store + environment + fingerprint batem.

### P0.2 `Payment.externalId` unico por store+environment

Status: `concluido`

Problema: `@@unique([storeId, externalId])` e `externalIdExists(externalId, storeId)` ignoram environment. TEST `order-1` impede LIVE `order-1`. Product ja recorta por environment.

Impacto: integrador que usa o mesmo id de pedido nos dois ambientes toma `EXTERNAL_ID_ALREADY_EXISTS` no LIVE sem necessidade. Isolamento de identidade fica pela metade.

Evidencia:

- `packages/database/prisma/schema.prisma` (Payment `@@unique([storeId, externalId])`)
- `packages/infrastructure/src/repositories/payment.repository.ts` (`externalIdExists` sem environment)
- `packages/core/src/application/use-cases/create-payment.use-case.ts` (check so storeId)
- Contraste: `Product` `@@unique([storeId, environment, externalId])`

Subtasks:

- [x] P0.2.1 Indice e check passam a ser `storeId + environment + externalId`.
  - Problema: o unique atual e store-wide.
  - Solucao: migration do indice (dropar o antigo; `externalId` nulo continua permitido em Postgres). Porta `externalIdExists` ganha `environment`. Create payment usa o environment do input.
  - Validacao: spec TEST e LIVE com o mesmo `externalId` criam dois payments; segundo TEST com o mesmo id continua conflito.
- [x] P0.2.2 Documentar a regra em `docs/DATA_MODEL.md` e `docs/CURRENT_STATE.md`.
  - Validacao: a frase de unicidade de payment bate com Product (por environment).

Done Criteria:

- [x] `externalId` de payment e unico dentro de `storeId + environment`.
- [x] TEST e LIVE da mesma store podem repetir o id de pedido.

## P1 - Contrato HTTP e docs

### P1.1 Unique violation deixar de ser 500

Status: `concluido`

Problema: o exists check e TOCTOU. Dois `POST /payments` concorrentes com o mesmo `externalId` passam o use case e batem no unique do Postgres. Nao ha filtro de `PrismaClientKnownRequestError` / `P2002`. Filter global so pega `DomainError` e `HttpException`. Vira 500.

Impacto: a corrida que o indice protege aparece como erro interno. Depois de P0.2 o recorte muda, mas a corrida continua no mesmo ambiente.

Evidencia:

- `apps/api/src/main.ts` (so `DomainExceptionFilter` + `HttpExceptionFilter`)
- `apps/api/src/common/constants/error-codes.ts` (code desconhecido -> 500)
- Nenhum `P2002` em `apps/api`

Subtasks:

- [x] P1.1.1 Traduzir unique do Prisma para DomainError 409 (`EXTERNAL_ID_ALREADY_EXISTS` / equivalente por constraint).
  - Problema: Prisma fura o catalogo.
  - Solucao: filter (ou map no repositorio) de `P2002` nas constraints de payment `externalId` e, se o mesmo seam servir, idempotency `(key, storeId, environment)`. Nao engolir todo unique do banco num 409 generico sem code.
  - Validacao: spec do filter/repo: P2002 da constraint de payment externalId -> 409 com `error.code`; constraint desconhecida nao vira 200.

Done Criteria:

- [x] Corrida de `externalId` no mesmo environment e 409 com code, nao 500.
- [x] Unique de idempotencia no mesmo environment continua 409 de conflito/replay, nao 500.

### P1.2 README da API deixar de ensinar saque/estorno com API key

Status: `concluido`

Problema: `docs/CURRENT_STATE.md` ja diz JWT-only em create de saque, refund e destino Pix. `apps/api/README.md` ainda fala em "API keys ainda nao possuem scopes granulares" e os exemplos de `POST /withdrawals` e `POST /refunds` usam `Authorization: Bearer hk_test_xxx`. Exemplo de `POST /checkout-sessions` omite `Idempotency-Key` (a secao de cima diz que e obrigatorio).

Impacto: integrador copia o README da API e toma 403 no saque/estorno, ou cria session sem key e 400.

Evidencia:

- `apps/api/README.md` (observacao de scopes; exemplos de saque/refund com `hk_test_`; create de checkout session sem `Idempotency-Key`)
- Contraste: `docs/CURRENT_STATE.md` (JWT-only; tabela de idempotencia com as cinco mutacoes)

Subtasks:

- [x] P1.2.1 Reescrever observacao e exemplos de saque/refund para cookie JWT (dashboard). API key -> 403 documentado.
  - Validacao: `rg "hk_test_xxx" apps/api/README.md` nao aparece em `/withdrawals` nem `/refunds`.
- [x] P1.2.2 Exemplo de checkout-session inclui `Idempotency-Key`.
  - Validacao: o bloco curl de create session tem o header, igual payments.

Done Criteria:

- [x] README da API descreve saque/refund como JWT-only.
- [x] Os cinco creates com `Idempotency-Key` tem exemplo (ou o de session deixa de omitir).

### P1.3 Documentar simulate TEST e identidade por environment

Status: `concluido`

Problema: key TEST ainda confirma, libera, paga Payment Link e conclui/falha saque no Account compartilhado (`/dev/simulate`, `/payment-links/:id/pay`, `/dev/withdrawals`). A goal nao muda essa authz. Sem frase canonica, a proxima review trata como regressao. CURRENT_STATE/DATA_MODEL tambem ainda descrevem `externalId` de payment e idempotencia como store-wide.

Impacto: operador acha que API key TEST e read-only depois do JWT-only de saque.

Evidencia:

- `apps/api/src/modules/payment/dev.controller.ts`
- `apps/api/src/modules/payment-link/payment-link.controller.ts` (`payAuthenticated`)
- `apps/api/src/modules/withdrawal/withdrawal-dev.controller.ts`
- `docs/CURRENT_STATE.md` (idempotencia e isolamento; nao fala em simulate via key)

Subtasks:

- [x] P1.3.1 CURRENT_STATE: key TEST pode simular (confirm/release/pay-link/withdrawal-dev) no saldo da store; LIVE key nao. Create de saque/refund/destino continua JWT-only.
  - Validacao: a secao Isolamento/Withdrawals diz as duas regras, sem contrair o README da API.
- [x] P1.3.2 CURRENT_STATE + DATA_MODEL: idempotency e `Payment.externalId` sao por `storeId + environment`. Customer continua store-wide (sem coluna de environment).
  - Validacao: nenhuma frase afirma unique store-only nesses dois.

Done Criteria:

- [x] Doc e README da API descrevem a mesma authz de saque vs simulate.
- [x] Unicidade de identidade TEST/LIVE esta escrita igual ao schema desta goal.

## Public APIs / Interfaces Mentioned By This Goal

- Reserva de `Idempotency-Key` passa a ser `(key, storeId, environment)`.
- `IPaymentRepository.externalIdExists` passa a exigir environment.
- Unique de Payment `externalId` no Prisma muda de `(storeId, externalId)` para `(storeId, environment, externalId)`.
- Unique Prisma `P2002` das constraints desta goal vira 409 com code.
- README da API deixa de mandar API key em saque/refund.

## Validation Log For This Goal

- [x] `pnpm --filter @hockpay/core test:ci`
- [x] `pnpm --filter @hockpay/infrastructure test`
- [x] `pnpm --filter @hockpay/api test`
- [x] `pnpm --filter @hockpay/worker test`
- [x] `pnpm --filter @hockpay/web test -- --watch=false`
- [x] `pnpm run lint:check`

Comandos tipicos:

```bash
pnpm --filter @hockpay/core test
pnpm --filter @hockpay/infrastructure test
pnpm --filter @hockpay/api test
pnpm --filter @hockpay/worker test
pnpm --filter @hockpay/web test -- --watch=false
pnpm run lint:check
```

## Fora desta goal

- JWT-only em `/dev/simulate`, pay autenticado de Payment Link ou withdrawal-dev (so documentar).
- Unicidade de Customer por environment (sem coluna; continua store-wide).
- Ledger TEST/LIVE separado (`Account` por environment).
- Workspace de webhooks/alerts (eventos refund/saque, chrome Email/WhatsApp, paginacao de logs).
- Processamento real de Pix, cartao, boleto, debito ou payout bancario.
- Payment Link com `items` / catalogo.
- CRUD de checkout session no dashboard.
- Settings mutavel de fee/settlement.
- OAuth, reset de senha, notificacoes, antifraude real.
- RBAC / scopes granulares de API key.
- Marketplace, split, DDD rewrite, smoke Docker no PR.

## Assumptions

- Caminho escolhido: `/GOAL.md` como unico tracker desta goal; as tres anteriores vivem em `docs/goals/`.
- Ordenacao: criticidade (P0 → P1); identidade primeiro, docs depois.
- Recorte: fechar o furo de identidade TEST/LIVE e o README que o integrador copia; nao abrir produto nem a fatia B de UI.
- P0.1 assume environment da request (JWT=TEST, API key=environment da key), o mesmo `@CurrentEnvironment()`.
- P1.1 mapeia constraints conhecidas, nao um catch-all de todo unique do schema.
- P1.3 assume que simulate via key TEST no Account compartilhado e recorte consciente, nao bug a fechar agora.
