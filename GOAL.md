# Hockpay - Goal

Source repo: `/Users/jpcass/Documents/2026/hockpay`
Last reviewed: `2026-08-18`
Ordering: criticidade primeiro
Scope: cancel LIVE de Payment Link, estorno via API key, isolamento de recibo, simulate quebrado do dashboard e docs canonicos alinhados ao runtime

Este arquivo e o tracker executavel da goal atual. Cada macro item e uma unidade de planejamento; as checkboxes em `Subtasks` sao as unidades executaveis de implementacao e validacao.

As duas passagens anteriores (arquivadas em `docs/goals/2026-08-18-architecture-hardening.md` e `docs/goals/2026-08-18-workspace-honesty-and-integrity.md`) fecharam escrita financeira no caminho de payment, catalogo DomainError, CombinedAuth/CurrentStore no caminho principal, replay de fulfill/pay, JWT-only de saque, perfil name+city, Payment Link com customer e paginacao SQL. Esta goal cobre o que ainda fura isolacao/authz (cancel de link, estorno, recibo), o simulate do dashboard que a coleta de customer quebrou, e o que os docs ainda descrevem do mundo anterior.

## Status Legend

- `nao iniciado`
- `em planejamento`
- `em implementacao`
- `em validacao/hardening`
- `concluido`

## Priority Legend

- `P0`: risco de integridade, key TEST mutando saldo da store, invariante financeira, ou isolamento de escrita quebrado.
- `P1`: isolamento de leitura herdado, contrato HTTP/erro, extração de contexto, docs/README que mentem, copy de simulador que promete canal inexistente.
- `P2`: acabamento, N+1 e typing que nao muda o contrato.

## Intake Snapshot

- Branch da review: `main` (13 commits a frente de `origin/main` no momento da abertura).
- Fonte: leitura pos-goal de `packages/core`, `packages/infrastructure`, `apps/api`, `apps/worker`, `apps/web`, `apps/checkout` e docs canonicos.
- Docs canonicos considerados: `README.md`, `docs/CURRENT_STATE.md`, `docs/PRODUCT.md`, `docs/DATA_MODEL.md`, `docs/RUNBOOK.md`, `docs/TARGET_ARCHITECTURE.md`.
- Decisao de recorte: nao reabrir ledger dual, nao filtrar listagem de saque (continua store-wide), nao criar coluna de environment em Receipt/Refund, nao construir RBAC/scopes. Fechar o que as duas passagens deixaram de proposito no fim da fila e parar de documentar o runtime antigo.

## P0 - Integridade financeira restante

### P0.1 Recusar cancel de Payment Link LIVE a partir de sessao/key TEST

Status: `concluido`

Problema: confirm/expire/fail/release/refund e o pay publico recusam agregado LIVE. `CancelPaymentLinkUseCase` carrega por `id + storeId`, nao le `environment` e nao chama `assertNotLiveEnvironment`. O controller autentica TEST, cancela a linha LIVE (e a `PixCharge` aberta) e so depois faz get filtrado — o caller TEST toma 404 com o link ja cancelado.

Impacto: a mesma classe TEST→LIVE que a passagem anterior fechou no payment. Nao mexe no ledger compartilhado, mas muta catalogo e charge LIVE.

Evidencia:

- `packages/core/src/application/use-cases/cancel-payment-link.use-case.ts` (input sem environment; `findLinkForUpdate` por store)
- `apps/api/src/modules/payment-link/payment-link.controller.ts` (cancel executa e so depois get com environment)
- Contraste: pay/fail passam por `validateTestEnvironment` / `ensureSimulationAllowed`

Subtasks:

- [x] P0.1.1 Recusar `paymentLink.environment === LIVE` no use case de cancel.
  - Problema: o check esta no get posterior, nao na mutacao.
  - Solucao: environment obrigatorio; LIVE -> `LiveEnvironmentNotAllowedError` (ou 404 se o recorte for o mesmo de get). Charge so cancela se o link for TEST.
  - Validacao: spec JWT/TEST + link LIVE -> 422/404, status e PixCharge inalterados.

Done Criteria:

- [x] JWT TEST + id de Payment Link LIVE nao cancela o link nem a charge.
- [x] API key TEST nao cancela link LIVE.

### P0.2 Estorno deixar de aceitar API key

Status: `nao iniciado`

Problema: a goal anterior fechou `POST /withdrawals` com `JwtOnlyGuard` porque key vazada era god-mode no Account compartilhado. `POST /refunds` ficou em `CombinedAuthGuard`. Qualquer `hk_test_` / `hk_live_` da store ainda estorna e debita o mesmo saldo.

Impacto: o recorte de P1.6 da passagem anterior ficou pela metade. Uma key de integracao (sem UI, sem sessao) continua podendo reverter pagamento e mexer no ledger.

Evidencia:

- `apps/api/src/modules/refund/refund.controller.ts:30-38`
- Contraste: `apps/api/src/modules/withdrawal/withdrawal.controller.ts:54-56`
- `docs/CURRENT_STATE.md:87` ainda fala em JWT/API key no saque e "API keys ainda nao possuem scopes granulares"

Subtasks:

- [ ] P0.2.1 Aplicar a mesma trava de saque no create de refund.
  - Problema: CombinedAuth basta para estornar.
  - Solucao: `JwtOnlyGuard` em `POST /refunds`. Nao abrir campo `scopes` nem RBAC.
  - Validacao: spec API key + payment da store -> 403; JWT dashboard continua 201/replay.

Done Criteria:

- [ ] API key recem-criada (default) nao estorna.
- [ ] JWT do dashboard continua estornando em TEST.

## P1 - Isolamento herdado, contexto e honestidade

### P1.1 Recibos herdarem o environment do payment

Status: `nao iniciado`

Problema: list/get de Payment e timeline agora exigem environment. Receipt nao tem coluna propria e `GetReceiptUseCase` / `ListReceiptsUseCase` so recortam por `storeId`. JWT TEST (sempre TEST) le recibo de payment LIVE se souber o id ou se a lista da store vier misturada. O get por `receiptId` / `receiptNumber` / `paymentId` tambem nao recebe environment. Customer-history de payments filtra environment; o de receipts nao.

Impacto: o isolamento de leitura da passagem anterior e so do agregado Payment. O comprovante (pagador, documento, valor) fura — inclusive pela rota de historico.

Evidencia:

- `packages/core/src/application/use-cases/get-receipt.use-case.ts:6-46`
- `packages/core/src/application/use-cases/list-receipts.use-case.ts:5-39`
- `apps/api/src/modules/receipt/receipt.controller.ts:30-98`
- `apps/api/src/modules/customer-history/customer-history.controller.ts:52-65` vs `103-116`
- `docs/CURRENT_STATE.md:133` ("Receipt/refund herdam o ambiente do payment")

Subtasks:

- [ ] P1.1.1 Passar `environment` obrigatorio em list/get de receipt e filtrar pelo `payment.environment`.
  - Problema: o dado ja esta no payment; o use case nao junta.
  - Solucao: join/filter no repositorio; 404 se o ambiente nao bate. Sem coluna nova em Receipt.
  - Validacao: spec JWT TEST + receipt de payment LIVE -> not found; lista TEST nao inclui LIVE.
- [ ] P1.1.2 Get por `paymentId` / `receiptNumber` e o historico de receipts usam o mesmo recorte.
  - Problema: tres entradas autenticadas + customer-history; um furo em qualquer uma basta.
  - Solucao: um input com environment; as rotas passam o decorator.
  - Validacao: as rotas recusam o mesmo caso LIVE.

Done Criteria:

- [ ] JWT TEST / key TEST nao le recibo de payment LIVE (dashboard, get por numero/id/payment e customer-history).
- [ ] Nao existe caminho de list/get Receipt sem environment.
- [ ] Schema de Receipt inalterado (sem coluna de environment).

### P1.2 Get de Payment Link nao aceitar environment opcional

Status: `nao iniciado`

Problema: o controller autenticado ja passa `@CurrentEnvironment()`. O use case de get ainda trata `environment` como opcional e so filtra `if (input.environment)`. `ListPaymentLinksOptions.environment` tambem e opcional; o SQL so aplica o `AND` quando o campo vem. Caller novo (ou teste) que omite o campo le link LIVE.

Impacto: o mesmo bypass que P1.1.2 da goal anterior fechou em Payment.

Evidencia:

- `packages/core/src/application/use-cases/get-payment-link.use-case.ts:9-21`
- `packages/core/src/domain/repositories/payment-link.repository.interface.ts` (`environment?:`)
- `packages/infrastructure/src/repositories/payment-link.repository.ts` (`options.environment ? AND ... : empty`)
- Contraste: `packages/core/src/application/use-cases/get-payment.use-case.ts:14,43`

Subtasks:

- [ ] P1.2.1 Tornar `environment` obrigatorio no get e no list de Payment Link.
  - Problema: omitir o campo desliga o isolamento.
  - Solucao: o tipo exige environment; 404 se nao bate; list sem environment nao compila.
  - Validacao: spec JWT TEST + link LIVE -> not found; list TEST nao inclui LIVE.

Done Criteria:

- [ ] Nao existe overload de get/list Payment Link sem environment.

### P1.3 Destinos Pix e merchant sem `req.user`

Status: `nao iniciado`

Problema: `POST /bank-accounts` esta em CombinedAuth, mas resolve o merchant com `req.user?.sub || req.user?.id || req.store?.merchantId`. CombinedAuth de API key so seta `store: { id }`. O caminho de key cai em `GetMerchantUseCase(undefined)` -> `MERCHANT_NOT_FOUND`. Create/delete/default de destino alimentam o saque, que ja e JWT-only.

Impacto: o contrato HTTP mente (CombinedAuth) e o codigo depende de shape de request. Key nao cria destino hoje (falha fechada), mas o merchant da titularidade nao vem da store.

Evidencia:

- `apps/api/src/modules/bank-account/bank-account.controller.ts:40-58`
- `apps/api/src/modules/auth/guards/combined-auth.guard.ts:49-51,113`
- `packages/core/src/application/use-cases/create-bank-account.use-case.ts:20-34`

Subtasks:

- [ ] P1.3.1 Mutacoes de bank account ficam JWT-only, no padrao do saque.
  - Problema: CombinedAuth no destino + saque JWT-only e contrato partido.
  - Solucao: `JwtOnlyGuard` em create/delete/setDefault. List autenticado pode continuar CombinedAuth ou tambem JWT; documentar a escolha.
  - Validacao: spec API key em POST/PATCH/DELETE -> 403; JWT continua.
- [ ] P1.3.2 Titularidade sai da store, nao de `req.user`.
  - Problema: mesmo no JWT, o controller adivinha `sub` / `id` / `merchantId`.
  - Solucao: o use case carrega `store.merchantId` e o merchant correspondente.
  - Validacao: spec do use case sem objeto de request; mismatch de documento continua 422.

Done Criteria:

- [ ] API key nao cria, nao apaga e nao promove destino Pix.
- [ ] Create de bank account nao le `req.user` / `req as any`.

### P1.4 Terminar `@CurrentStore()` / `@CurrentEnvironment()`

Status: `nao iniciado`

Problema: P0.3 da passagem anterior limpou o caminho financeiro antigo. Alert ainda tem `getStoreId` em `(req as any).user.storeId`. Customer-history remonta 403 na mao. Dashboard overview le `(req as any)?.environment`. Dev de payment/withdrawal ainda extraem environment do request cru. O decorator ja existe e e a regra.

Impacto: store ausente ou environment omitido volta a depender do shape do Express. O mapa mental de "so o decorator le contexto" mente.

Evidencia:

- `apps/api/src/modules/alert/alert.controller.ts:201-203`
- `apps/api/src/modules/customer-history/customer-history.controller.ts:149-168`
- `apps/api/src/modules/dashboard/dashboard.controller.ts:64-66`
- `apps/api/src/modules/payment/dev.controller.ts:157`
- `apps/api/src/modules/withdrawal/withdrawal-dev.controller.ts:87`

Subtasks:

- [ ] P1.4.1 Trocar extracao manual por `@CurrentStore()` / `@CurrentEnvironment()` nos controllers listados.
  - Problema: cada handler reimplementa o guard.
  - Solucao: os decorators ja existem.
  - Validacao: `rg "req as any" apps/api/src --glob '*.controller.ts'` sem store/environment/user.storeId.
- [ ] P1.4.2 Customer-history deixa de fabricar `ForbiddenException` de store.
  - Problema: payload paralelo ao decorator.
  - Solucao: `@CurrentStore()`; a regra API-key-only pode ficar como guard/check de `authType` se ainda for o contrato.
  - Validacao: store ausente -> 403 `NO_CURRENT_STORE` do decorator.

Done Criteria:

- [ ] Controllers autenticados nao leem `req as any` para store nem environment.
- [ ] Overview usa o mesmo environment da sessao/key.

### P1.5 Um filter so nos remappers que sobraram

Status: `nao iniciado`

Problema: P1.4 da passagem anterior limpou webhook/customer/receipt/dev. Store (slug), account (`GET /accounts/me`) e webhook-inbox ainda remapam `DomainError` na mao. Os codes ja estao em `ERROR_CODE_MAP`.

Impacto: status/payload ainda podem divergir do filter nessas rotas.

Evidencia:

- `apps/api/src/modules/store/store.controller.ts:116-129`
- `apps/api/src/modules/account/account.controller.ts:32-47`
- `apps/api/src/modules/webhook/webhook-inbox.controller.ts:52-61`
- `apps/api/src/common/constants/error-codes.ts` (`SLUG_ALREADY_EXISTS`, `INVALID_SLUG_FORMAT`, `ACCOUNT_NOT_FOUND`, `WEBHOOK_CONFIG_NOT_FOUND`)

Subtasks:

- [ ] P1.5.1 Remover traducao local de dominio nesses controllers.
  - Problema: dois tradutores.
  - Solucao: deixar o filter. Auth (refresh/logout) so entra se o erro for `DomainError` ja mapeado e o cookie flow nao precisar de status especial.
  - Validacao: specs ainda veem 4xx via filter; sem `instanceof SlugAlreadyExistsError` / `AccountNotFoundError` / `WebhookConfigNotFoundError` no delivery.

Done Criteria:

- [ ] Store, account e webhook-inbox nao tem remapper local para `DomainError`.
- [ ] Payload de erro e o do filter.

### P1.6 Reconciliar docs canonicos com o runtime pos-duas-goals

Status: `nao iniciado`

Problema: `docs/CURRENT_STATE.md`, `docs/PRODUCT.md`, `docs/DATA_MODEL.md`, `README.md` e `apps/web/README.md` ainda descrevem Settings como 100% read-only, saque via JWT/API key sem scopes, Payment Link sem customer e Store/Withdrawal sem `city` / `environment`.

Impacto: a fonte canonica mente sobre o que a passagem anterior entregou. Integrador e o proximo agente leem o estado antigo.

Evidencia:

- `docs/CURRENT_STATE.md:11,38,62-63,87`
- `docs/PRODUCT.md:71`
- `docs/DATA_MODEL.md:18-23,47-55,102`
- `README.md:49`
- `apps/web/README.md:35,50`

Subtasks:

- [ ] P1.6.1 Atualizar CURRENT_STATE, PRODUCT, DATA_MODEL, README raiz e README do web.
  - Problema: as frases apontam para o mundo pre-name/city e pre-JWT-only.
  - Solucao: Settings = perfil (`name`, `city`) mutavel; fee/settlement imutaveis. Saque create = JWT-only. Payment Link publico coleta customer. Store tem `city`. Withdrawal tem `environment` (listagem continua store-wide).
  - Validacao: `rg "settings parcial|Parcial/read-only|scopes granulares|JWT/API key e" docs README.md apps/web/README.md` nao contradiz o runtime.

Done Criteria:

- [ ] Docs canonicos descrevem Settings, saque, Payment Link customer, `Store.city` e `Withdrawal.environment` como o codigo.
- [ ] Listagem de saque continua documentada como store-wide.

### P1.7 Copy de simulador que ainda promete canal inexistente

Status: `nao iniciado`

Problema: checkout confirmado diz "Voce recebera uma confirmacao em breve" e nao ha email/notificacao. Timeline de saque no core rotula sucesso como "Pix enviado" / "processamento Pix". O produto nao envia e-mail e nao faz payout Pix.

Impacto: o comprador de demo e o operador leem um canal que `docs/PRODUCT.md` proibe.

Evidencia:

- `apps/checkout/src/components/checkout/CheckoutPage.tsx:183`
- `packages/core/src/application/use-cases/get-withdrawal.use-case.ts:82,100`
- `apps/web/src/app/features/dashboard/pages/withdrawals/withdrawals.html:113`

Subtasks:

- [ ] P1.7.1 Trocar o sucesso do checkout para linguagem de simulacao, sem promessa de e-mail.
  - Validacao: `rg "confirmação em breve|confirmacao em breve" apps/checkout` vazio.
- [ ] P1.7.2 Timeline/copy de saque fala em saque simulado / saldo reservado, nao em Pix enviado de verdade.
  - Validacao: `rg "Pix enviado" packages/core apps/web` vazio ou contextualizado como simulacao.
- [ ] P1.7.3 Landing deixa de vender "comportamento do gateway antes da request", "fluxo real" e "seguro" como se houvesse adquirencia.
  - Evidencia: `apps/web/src/app/features/landing/pages/home/home.html` (copy de gateway / sandbox / retorno seguro).
  - Validacao: `rg "fluxo real|antes da request|retorno seguro" apps/web/src/app/features/landing` vazio.

Done Criteria:

- [ ] Checkout nao promete confirmacao por e-mail.
- [ ] Timeline de saque nao afirma payout Pix real.
- [ ] Landing nao afirma outcome pre-request nem processamento real.

### P1.8 Dashboard simulate de Payment Link honrar o customer obrigatorio

Status: `nao iniciado`

Problema: a passagem anterior passou a exigir `customer.document` no pay publico e no use case. O dashboard ainda posta `{}` em `POST /payment-links/:id/pay` e o botao "Pagar" parece acao TEST valida. Fail autenticado continua funcionando; pay autenticado e 422.

Impacto: o no-code que a goal anterior fechou no checkout quebrou o simulate do merchant. CTA primaria mente.

Evidencia:

- `apps/web/src/app/core/services/payment-link.service.ts` (`simulatePay` com body vazio)
- `apps/web/src/app/features/dashboard/pages/payment-link-detail/payment-link-detail.ts` (`simulatePay`)
- `apps/api/src/modules/payment-link/payment-link.controller.ts` (`payAuthenticated` sem customer)
- `packages/core/src/application/use-cases/pay-payment-link.use-case.ts` (`CustomerDocumentRequiredError`)

Subtasks:

- [ ] P1.8.1 Pay autenticado do dashboard envia um customer TEST ou deixa de se apresentar como Pagar.
  - Problema: body vazio depois de P1.10 da goal anterior.
  - Solucao: coletar documento no dialog de simulate **ou** desabilitar o botao com texto honesto ("use o checkout publico"). Nao inventar pagador silencioso sem o operador ver.
  - Validacao: spec/UI — pay autenticado com documento cria payment+customer; sem documento nao parece sucesso.

Done Criteria:

- [ ] CTA de simulate no detalhe do link nao devolve 422 por falta de customer.
- [ ] Payment gerado pelo dashboard tem `customerId` quando o pay ocorre.

## P2 - Acabamento

### P2.1 Hidratar items do recibo sem N+1

Status: `nao iniciado`

Problema: `ListReceiptsUseCase` chama `paymentRepository.findByIdAndStoreId` por linha so para copiar `items`. A lista ja pagina no SQL; o detalhe do catalogo volta a ser N queries.

Impacto: store com muitos recibos fica lenta na tela de comprovantes.

Evidencia:

- `packages/core/src/application/use-cases/list-receipts.use-case.ts:42-54`
- `packages/infrastructure/src/repositories/receipt.repository.ts:63-72`

Subtasks:

- [ ] P2.1.1 Carregar items da pagina em lote (join ou `IN` dos paymentIds).
  - Validacao: spec/repo com N recibos nao faz N `findById` de payment.

Done Criteria:

- [ ] Listagem autenticada de receipts nao hidrata items com uma query por linha.

### P2.2 Parar de castear `prisma as any` no Payment Link

Status: `nao iniciado`

Problema: o list SQL da passagem anterior ainda hidrata a pagina com `(this.prisma as any).paymentLink.findMany`. O modelo existe no schema.

Impacto: o compiler nao pega include/where quebrado nesse caminho.

Evidencia:

- `packages/infrastructure/src/repositories/payment-link.repository.ts:121,144`

Subtasks:

- [ ] P2.2.1 Usar o client tipado (ou o bag do UoW) para `paymentLink`.
  - Validacao: `rg "prisma as any" packages/infrastructure/src/repositories/payment-link.repository.ts` vazio.

Done Criteria:

- [ ] Repositorio de Payment Link nao acessa o modelo via `as any`.

## Public APIs / Interfaces Mentioned By This Goal

- Cancel de Payment Link recusa agregado LIVE mesmo com request TEST.
- `POST /refunds` deixa de aceitar API key.
- `GET /receipts` (e customer-history de receipts) passam a exigir e honrar environment (via payment).
- Get/list de Payment Link deixam de ter environment opcional.
- Pay autenticado de Payment Link no dashboard exige customer visivel ou some como CTA.
- Mutacoes de `bank-accounts` ficam JWT-only; titularidade vem da store.
- `@CurrentStore()` / `@CurrentEnvironment()` cobrem alert, customer-history, dashboard e `/dev/*`.
- Store, account e webhook-inbox deixam o filter traduzir DomainError.
- Docs canonicos deixam de contradizer Settings, saque JWT-only e Payment Link com customer.

## Validation Log For This Goal

- [ ] `pnpm --filter @hockpay/core test:ci`
- [ ] `pnpm --filter @hockpay/infrastructure test`
- [ ] `pnpm --filter @hockpay/api test`
- [ ] `pnpm --filter @hockpay/worker test`
- [ ] `pnpm --filter @hockpay/web test -- --watch=false`
- [ ] `pnpm run lint:check`

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

- Processamento real de Pix, cartao, boleto, debito ou payout bancario.
- Ledger TEST/LIVE separado (`Account` por environment).
- Filtrar listagem de saque por environment (decisao da goal anterior: store-wide).
- Coluna de environment em Receipt, Refund, Customer, BankAccount ou WebhookConfig.
- Payment Link com `items` / catalogo.
- CRUD de checkout session no dashboard.
- Settings mutavel de fee, settlement, aprovacao ou "revisao comercial".
- OAuth GitHub, reset de senha por email, notificacoes in-app, antifraude real.
- RBAC / scopes granulares de API key alem do JWT-only ja adotado.
- Unicidade de `Payment.externalId` por environment (hoje e `storeId + externalId`).
- Canais de alerta email/WhatsApp; so Discord continua.
- Marketplace, split, multi-seller.
- Estoque, variantes, tags, storefront.
- Domain events in-process; reescrita DDD das entidades anemicas.
- Smoke Docker no PR (decisao da goal de hardening / `TARGET_ARCHITECTURE`).

## Assumptions

- Caminho escolhido: `/GOAL.md` como unico tracker desta goal; as duas anteriores vivem em `docs/goals/`.
- Ordenacao: criticidade (P0 → P1 → P2); dentro da faixa, risco primeiro.
- Recorte: fechar authz/isolamento/docs que as duas passagens deixaram; nao abrir produto novo.
- P0.1 assume o mesmo recorte de saque (JWT-only), nao um sistema de permissoes.
- P1.1 assume join em `payment.environment`, nao dual ledger e nao coluna nova em Receipt.
- P1.3 assume destinos Pix como operacao de merchant (JWT), porque saque ja e JWT-only.
- Listagem de Withdrawal permanece store-wide; so o create grava environment para recusar acao TEST sobre reserva LIVE.
