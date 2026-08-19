# Hockpay - Goal

Source repo: `/Users/jpcass/Documents/2026/hockpay`
Last reviewed: `2026-08-18`
Ordering: criticidade primeiro
Scope: fechamento da passagem de 2026-08-18 + honestidade do workspace merchant

Este arquivo e o tracker executavel da goal atual. Cada macro item e uma unidade de planejamento; as checkboxes em `Subtasks` sao as unidades executaveis de implementacao e validacao.

A passagem anterior (arquivada em `docs/goals/2026-08-18-architecture-hardening.md`) fechou DomainError no caminho financeiro antigo, CombinedAuth (store, precedencia, leak de JWT), filtro TEST/LIVE nas listas com coluna, indice parcial de PixCharge, miolo unico de confirm, UoW de checkout, webhook DNS pin, idempotencia de creates, Money morto, fee/net, PIX-only na escrita e higiene de CI/docs. Esta goal cobre o que essa passagem deixou incompleto e o que o workspace ainda promete sem cumprir.

## Status Legend

- `nao iniciado`
- `em planejamento`
- `em implementacao`
- `em validacao/hardening`
- `concluido`

## Priority Legend

- `P0`: risco de integridade, sessao/key TEST mutando saldo LIVE, isolamento quebrado na escrita, invariante financeira, ou erro de negocio que vira 500.
- `P1`: confiabilidade operacional, contrato HTTP/erro, authz minima, docs/README que mentem, UX operacional material, chrome que finge produto inexistente.
- `P2`: acabamento, copy de simulador, dead code e clareza.

## Intake Snapshot

- Branch da review: `main` (5 commits a frente de `origin/main` no momento da abertura).
- Fonte: leitura pos-goal de `packages/core`, `packages/infrastructure`, `apps/api`, `apps/worker`, `apps/web`, `apps/checkout` e docs canonicos.
- Docs canonicos considerados: `README.md`, `docs/CURRENT_STATE.md`, `docs/PRODUCT.md`, `docs/DATA_MODEL.md`, `docs/RUNBOOK.md`, `docs/TARGET_ARCHITECTURE.md`.
- Decisao de recorte: nao abrir catalogo em Payment Link, checkout session no dashboard, OAuth, reset de senha por email, antifraude real nem ledger TEST/LIVE separado. Apertar o desenho que ja existe e deixar de mentir na UI.

## P0 - Integridade e Isolamento na Escrita

### P0.1 Recusar mutacao LIVE a partir de sessao/key TEST

Status: `concluido`

Problema: `/dev/simulate` e o withdrawal-dev so bloqueiam quando o **environment da request** e LIVE. JWT e forcado para TEST. `ConfirmPaymentUseCase` / expire / fail / release / `CreateRefundUseCase` travam por `storeId` e nao leem `payment.environment`. Checkout simulate e pay de Payment Link ja recusam agregado LIVE.

Impacto: dashboard (ou API key TEST) que conhece o id confirma, estorna ou conclui saque de dinheiro LIVE. Account e compartilhada por store; o credito/debito cai no mesmo saldo.

Evidencia:

- `apps/api/src/modules/payment/dev.controller.ts:191-202`
- `apps/api/src/modules/withdrawal/withdrawal-dev.controller.ts:81-91`
- `packages/core/src/application/use-cases/confirm-payment.use-case.ts:45-54`
- `packages/core/src/application/use-cases/create-refund.use-case.ts:42-49`
- Contraste: `packages/core/src/application/use-cases/simulate-checkout-payment.use-case.ts:80-83`

Subtasks:

- [x] P0.1.1 Recusar `payment.environment === LIVE` (e withdrawal/refund herdado de funding LIVE) em confirm, expire, fail, release, refund e nos controllers `/dev/*`.
  - Problema: o check esta no caller TEST, nao no agregado.
  - Solucao: o use case de mutacao financeira recusa LIVE com `LiveEnvironmentNotAllowedError`; o controller nao e a unica trava.
  - Validacao: spec JWT/TEST + payment LIVE -> 422, ledger inalterado.
- [x] P0.1.2 Aplicar a mesma regra no withdrawal-dev (complete/fail).
  - Problema: saque LIVE processado por sessao TEST mexe no Account compartilhado.
  - Solucao: o job/use case de acao TEST recusa withdrawal cujo contexto nao e TEST, ou documentar e recusar se a reserva veio de payment LIVE.
  - Validacao: spec de withdrawal-dev com funding LIVE nao altera saldo.

Done Criteria:

- [x] JWT TEST + id de payment LIVE nao confirma, nao expira, nao falha, nao libera e nao estorna.
- [x] API key TEST nao muta agregado LIVE.
- [x] Acao TEST de saque nao processa reserva LIVE.

### P0.2 Fechar o catalogo DomainError no filter

Status: `concluido`

Problema: `getStatusCodeForError` devolve 500 para code desconhecido. P0.1.4 da goal anterior so mapeou o que aquele PR tocou. Varios `DomainError` de producao continuam fora de `ERROR_CODE_MAP`. `POST /payments/:id/simulate/:action` (publico, checkout) nao tem remapper local e depende do filter.

Impacto: pagamento expirado, transicao invalida, customer/receipt/webhook/api-key not found e `NO_CURRENT_STORE` vazam como erro interno. O catalogo so protege o caminho que a passagem anterior reescreveu.

Evidencia:

- `apps/api/src/common/constants/error-codes.ts:184-186`
- `packages/core/src/domain/errors/payment-expired.error.ts:10`
- `packages/core/src/domain/errors/invalid-payment-status.error.ts:14`
- `packages/core/src/domain/errors/customer-not-found.error.ts:13`
- `packages/core/src/domain/errors/receipt-not-found.error.ts`
- `packages/core/src/domain/errors/no-current-store.error.ts:11`
- `apps/api/src/modules/payment/payment.controller.ts:238-256`

Subtasks:

- [x] P0.2.1 Mapear todo code de `packages/core/src/domain/errors` usado em producao.
  - Problema: code sem linha no mapa e 500.
  - Solucao: completar `ERROR_CODE_MAP` e `ERROR_CATEGORIES`; o spec lista os codes e falha se um arquivo de erro novo ficar de fora.
  - Validacao: `error-codes.spec.ts` cobre o catalogo inteiro, nao so o subset da goal anterior.
- [x] P0.2.2 Provar o caminho publico de simulate sem remapper local.
  - Problema: `/dev/simulate` ainda traduz na mao; o publico nao.
  - Solucao: o filter e a unica traducao; expired/status vira 4xx nos dois.
  - Validacao: spec do filter/controller para `PAYMENT_EXPIRED` e `INVALID_PAYMENT_STATUS_TRANSITION`.

Done Criteria:

- [x] Nenhum `DomainError` de producao cai em 500 por falta de mapping.
- [x] Simulate publico de payment expirado e 4xx com `error.code`.

### P0.3 Terminar `@CurrentStore()` e acabar com `Error` de store

Status: `concluido`

Problema: P0.2.4 padronizou payment, refund, payment-link e checkout. Webhook, receipt, customer, `/dev/simulate`, withdrawal-dev e create/revoke de API key ainda leem `(req as any)?.store?.id` e jogam `Error('Store ID not found in request')` (500). Api-key create/revoke usam `req.user.storeId` sem o decorator.

Impacto: o mesmo furo que a goal anterior fechou no caminho financeiro volta em webhook, recibo, customer e simulacao. Store ausente vira 500, nao 403 `NO_CURRENT_STORE`.

Evidencia:

- `apps/api/src/modules/auth/decorators/current-store.decorator.ts:22-35`
- `apps/api/src/modules/webhook/webhook.controller.ts:93-96` (e irmaos)
- `apps/api/src/modules/receipt/receipt.controller.ts:42-45`
- `apps/api/src/modules/customer/customer.controller.ts:80-83`
- `apps/api/src/modules/payment/dev.controller.ts:205-209`
- `apps/api/src/modules/withdrawal/withdrawal-dev.controller.ts:95-97`

Subtasks:

- [x] P0.3.1 Trocar extracao manual por `@CurrentStore()` nos controllers listados, inclusive api-key create/revoke.
  - Problema: cada handler reimplementa o contrato do guard.
  - Solucao: o decorator ja existe e devolve 403.
  - Validacao: `rg "Store ID not found in request" apps/api/src` vazio.
- [x] P0.3.2 Parar de jogar `Error` generico quando store falta.
  - Problema: o filter nao traduz `Error`.
  - Solucao: so o decorator / `NoCurrentStoreError`.
  - Validacao: spec do controller/guard sem store -> 403, nao 500.

Done Criteria:

- [x] Controllers autenticados de negocio nao leem `req as any` para store.
- [x] Store ausente e 403 com code, nunca 500.

## P1 - Contrato, Authz e Honestidade do Workspace

### P1.1 Timeline e leituras irmas honrarem environment

Status: `concluido`

Problema: list/get de Payment passaram a filtrar environment. `GetPaymentTimelineUseCase` nao recebe environment. JWT TEST carrega ledger, refunds, receipt e webhook logs de um payment LIVE se souber o id. `environment` em list/get ainda e opcional; um caller que omite bypassa o filtro.

Impacto: o isolamento de P0.3 da goal anterior e so da lista. O detalhe operacional (timeline) fura.

Evidencia:

- `packages/core/src/application/use-cases/get-payment-timeline.use-case.ts:56-88`
- `apps/api/src/modules/payment/payment.controller.ts:165-172`
- `packages/core/src/application/use-cases/list-payments.use-case.ts:23`
- `packages/core/src/application/use-cases/get-payment.use-case.ts:14,43`

Subtasks:

- [x] P1.1.1 Passar `environment` obrigatorio em timeline e recusar payment de outro ambiente.
  - Problema: timeline e get por id sem filtro.
  - Solucao: o mesmo recorte de `GetPaymentUseCase`; 404 se o ambiente nao bate.
  - Validacao: spec JWT TEST + payment LIVE -> not found, sem ledger.
- [x] P1.1.2 Tornar `environment` obrigatorio em list/get de Payment (nao opcional).
  - Problema: omitir o campo desliga o isolamento.
  - Solucao: o tipo exige environment; o compiler pega caller novo.
  - Validacao: chamada sem environment nao compila / nao existe overload sem filtro.

Done Criteria:

- [x] JWT TEST nao le timeline nem detalhe operacional de payment LIVE.
- [x] Nao existe caminho de list/get Payment sem environment.

### P1.2 Registrar a decisao do Account compartilhado

Status: `concluido`

Problema: `Account`, `Receipt`, `Refund`, `Withdrawal` e `Transaction` nao tem coluna de environment. Dashboard metrics e extrato sao store-wide. `docs/CURRENT_STATE.md` ja admite o recorte, mas o overview JWT (sempre TEST) ainda pode mostrar numeros LIVE da mesma store.

Impacto: isolamento de leitura fica pela metade; quem le o overview acha que e so TEST.

Evidencia:

- `packages/database/prisma/schema.prisma` (`Store.account` 1:1, sem environment)
- `docs/CURRENT_STATE.md` (secao Isolamento TEST/LIVE)
- `apps/api/src/modules/dashboard/dashboard.controller.ts:48-53`

Subtasks:

- [x] P1.2.1 Decidir e escrever: um Account por store (atual) vs Account por store+environment.
  - Problema: sem decisao, cada tela inventa um filtro.
  - Solucao: manter um Account (recorte atual) e filtrar metricas JWT para o que da para atribuir a TEST, ou deixar explicito no dashboard que o saldo e da store inteira.
  - Validacao: `docs/CURRENT_STATE.md` e o copy do overview/financials dizem a mesma regra.
- [x] P1.2.2 Nao abrir ledger dual nesta goal.
  - Problema: split de Account e produto financeiro novo.
  - Solucao: so documentar + UI honesta.
  - Validacao: schema de Account inalterado.

Done Criteria:

- [x] Doc e UI concordam se o saldo JWT e da store ou so TEST.
- [x] Nao nasce segunda Account sem PRD.

### P1.3 Idempotencia de fulfill (e replay do pay publico)

Status: `concluido`

Problema: creates financeiros exigem `Idempotency-Key`. `POST /checkout-sessions/:token/fulfill` nao. Retry depois do 200 vira `CheckoutSessionInvalidStatusError` (422), nao o mesmo `paymentId`. Pay publico do Payment Link e a mesma classe: segunda chamada nao devolve a tentativa ja paga.

Impacto: refresh do comprador / resposta perdida parece falha. O create foi endurecido; o passo que gera o Pix nao.

Evidencia:

- `apps/api/src/modules/checkout-session/checkout-session.controller.ts:97-111`
- `packages/infrastructure/src/repositories/checkout-session.repository.ts:83-93`
- `packages/core/src/application/use-cases/pay-payment-link.use-case.ts:48-108`

Subtasks:

- [x] P1.3.1 Fulfill da session aberta devolve o pagamento ja criado no replay.
  - Problema: claim so bumpa `updatedAt`; status continua OPEN ate o write final, e retry pos-sucesso e 422.
  - Solucao: se a session ja tem payment, devolver o mesmo body; se ainda OPEN, fingerprint por token (ou header) para nao criar segundo Pix.
  - Validacao: dois fulfills seguidos, um `paymentId`.
- [x] P1.3.2 Pay publico de link pago devolve a tentativa confirmada, nao "nao pagavel".
  - Problema: o dominio esta seguro; o cliente nao e idempotente.
  - Solucao: link `PAID` retorna o payment pago da charge.
  - Validacao: spec de replay do token publico.

Done Criteria:

- [x] Refresh/retry de fulfill nao cria segundo payment e nao parece erro.
- [x] Replay de pay em link ja pago devolve o payment existente.

### P1.4 Um filter so nos controllers que sobraram

Status: `concluido`

Problema: P1.5 limpou Payment, Payment Link e Product. Webhook, customer, receipt, customer-history e `/dev/simulate` ainda remapam `DomainError` na mao (`try/catch` + `BadRequestException` / `NotFoundException`).

Impacto: status/payload divergem do filter; erro novo precisa de patch em N handlers.

Evidencia:

- `apps/api/src/modules/webhook/webhook.controller.ts:116-133`
- `apps/api/src/modules/customer/customer.controller.ts:108-127`
- `apps/api/src/modules/payment/dev.controller.ts:218-250`
- `apps/api/src/common/filters/domain-exception.filter.ts`

Subtasks:

- [x] P1.4.1 Remover traducao local de dominio nesses controllers.
  - Problema: dois tradutores.
  - Solucao: deixar o filter; depende de P0.2 para os codes.
  - Validacao: specs ainda veem 4xx via filter; `rg "instanceof .*Error" apps/api/src/modules --glob '*.controller.ts'` so o que o filter nao cobre (se houver).
- [x] P1.4.2 Apagar `handleError` do dev controller.
  - Problema: mapa por tipo no delivery.
  - Solucao: o mesmo de P1.5.2 da goal anterior.
  - Validacao: simulate 404/422 nao usa switch de class name.

Done Criteria:

- [x] Webhook, customer, receipt e dev nao tem `mapError` local para `DomainError`.
- [x] Payload de erro e o do filter.

### P1.5 Reconciliar README da API com o runtime

Status: `concluido`

Problema: `apps/api/README.md` ainda diz que so payments/withdrawals/refunds sao idempotentes e que `paymentMethod` aceita card/boleto/debito. `docs/CURRENT_STATE.md` ja lista Payment Link + checkout session na idempotencia e escrita so PIX.

Impacto: integrador copia o README da API e erra o contrato.

Evidencia:

- `apps/api/README.md:45,52`
- `docs/CURRENT_STATE.md:126-127`
- `packages/core/src/application/use-cases/create-payment.use-case.ts` (rejeita nao-PIX)

Subtasks:

- [x] P1.5.1 Atualizar a secao de idempotencia e de `paymentMethod` do README da API.
  - Problema: a frase aponta para o passado.
  - Solucao: a mesma tabela/regra de CURRENT_STATE.
  - Validacao: `rg "Nem toda mutação é idempotente|nao possui processador real" apps/api/README.md` nao contradiz o runtime.

Done Criteria:

- [x] README da API lista as cinco mutacoes com `Idempotency-Key`.
- [x] README da API diz que escrita de cobranca e so PIX.

### P1.6 API keys: authz minima e superficie honesta

Status: `nao iniciado`

Problema: qualquer key da store saca, estorna e cria webhook. Dashboard so lista/cria TEST; key LIVE emitida pela API fica invisivel e irrevogavel na UI. `lastUsedAt` existe e nao aparece. Resposta de revoke inventa prefix/name/TEST. `InvalidApiKeyFormatError` embute a key em claro.

Impacto: key vazada e god-mode. Operador do dashboard nao ve nem revoga LIVE. Log de auth pode persistir o segredo.

Evidencia:

- `packages/database/prisma/schema.prisma:766-775`
- `docs/CURRENT_STATE.md:87`
- `apps/api/README.md:47`
- `apps/web/src/app/features/dashboard/pages/api-keys/api-keys.ts:121-141`
- `apps/api/src/modules/api-key/api-key.controller.ts:130-139`
- `packages/core/src/domain/errors/invalid-api-key-format.error.ts:8`

Subtasks:

- [ ] P1.6.1 Fechar saque (e, se o mesmo seam servir, refund) para API key sem escopo.
  - Problema: CombinedAuth basta para `POST /withdrawals`.
  - Solucao: preferir JWT-only em withdrawal/refund **ou** um campo `scopes` minimo (`payments`, `withdrawals`). Nao construir RBAC.
  - Validacao: key sem escopo de saque toma 403; JWT do dashboard continua.
- [ ] P1.6.2 Dashboard lista, cria (se permitido) e revoga keys LIVE; mostra `lastUsedAt`.
  - Problema: UI e TEST-only e esconde o campo que o schema ja tem.
  - Solucao: tirar o filtro hard-coded; revoke devolve o registro real.
  - Validacao: spec/UI de lista com LIVE; body de revoke nao inventa TEST.
- [ ] P1.6.3 Parar de colocar a key crua no erro/log.
  - Problema: `Invalid API Key format: ${key}`.
  - Solucao: mensagem estavel; no log so prefixo/length.
  - Validacao: spec do use case/guard sem o material da key.

Done Criteria:

- [ ] Key recem-criada (default) nao saca.
- [ ] LIVE e visivel e revogavel no dashboard.
- [ ] Erro/log de formato nao ecoa o segredo.

### P1.7 Chrome que finge produto inexistente

Status: `nao iniciado`

Problema: login/register tem GitHub sem handler. "Esqueceu a senha?" aponta para `#`. Sino do dashboard diz "nao disponiveis no P3". Settings ainda abre "Revisao comercial futura" sem backend.

Impacto: o workspace mente. `docs/TARGET_ARCHITECTURE.md` pede completar ou esconder placeholder.

Evidencia:

- `apps/web/src/app/features/auth` (login/register GitHub `type="button"` sem handler; forgot `href="#"`)
- `apps/web/src/app/shared/layouts/dashboard-layout/dashboard-layout.html:60-62`
- `apps/web/src/app/features/dashboard/pages/settings/settings.ts:246-273`

Subtasks:

- [ ] P1.7.1 Remover GitHub e o link de reset, ou desabilitar com texto honesto ("nao disponivel").
  - Problema: botao que parece OAuth.
  - Solucao: apagar; nao implementar OAuth/email nesta goal.
  - Validacao: `rg "GitHub|Esqueceu a senha" apps/web/src` sem CTA morto.
- [ ] P1.7.2 Remover o sino P3 e o dialog de revisao comercial.
  - Problema: linguagem interna e produto fantasma.
  - Solucao: Settings continua read-only nas condicoes comerciais (P1.9 cuida do perfil); sem botao de "revisao futura".
  - Validacao: `rg "P3|revisão futura|revisao futura" apps/web/src` vazio.

Done Criteria:

- [ ] Auth e shell do dashboard nao prometem OAuth, reset nem notificacoes.
- [ ] Settings nao vende revisao comercial.

### P1.8 Products e items: copy e investigacao no dashboard

Status: `nao iniciado`

Problema: a tela de Products diz que o catalogo alimenta "links de pagamento e checkout hospedado". Payment Link rejeita `items`. Checkout session com items e API-first (documentado). `PaymentObject.items` existe; payment-detail e receipt-detail nao renderizam.

Impacto: merchant cria produto e nao consegue gerar cobranca no dashboard. Ops nao ve o snapshot do catalogo sem abrir o banco.

Evidencia:

- `apps/web/src/app/features/dashboard/pages/products/products.html:29-30`
- `packages/core/src/application/use-cases/create-payment-link.use-case.ts:142-144`
- `apps/web/src/app/core/services/payment.service.ts:42,62-73`
- `apps/checkout/src/components/checkout/LineItemsSummary.tsx`

Subtasks:

- [ ] P1.8.1 Corrigir o copy de Products: catalogo alimenta checkout session via API; Payment Link continua amount-only.
  - Problema: a tela mente o contrato.
  - Solucao: texto alinhado a `docs/CURRENT_STATE.md`; CTA so para o que existe.
  - Validacao: `rg "links de pagamento" apps/web/src/app/features/dashboard/pages/products` vazio ou honesto.
- [ ] P1.8.2 Renderizar `items` em payment-detail e receipt-detail.
  - Problema: o dado ja chega no cliente.
  - Solucao: o mesmo resumo do checkout, autenticado.
  - Validacao: spec do detail com items mostra nome/qty/subtotal.

Done Criteria:

- [ ] Products nao promete Payment Link com catalogo.
- [ ] Pagamento/recibo com items e investigavel no dashboard.
- [ ] Esta goal **nao** adiciona `items` em Payment Link nem CRUD de checkout session no dashboard.

### P1.9 Settings: perfil da loja e cidade do EMV

Status: `nao iniciado`

Problema: Store nao tem cidade. `resolvePixMerchantCity()` e chamado sem argumento; o QR e sempre `SAO PAULO`. Settings e 100% leitura. Condicoes comerciais (fee, D+) devem continuar imutaveis pelo merchant.

Impacto: study-case fora de SP gera EMV mentiroso. Settings nao configura nem o que o simulador ja precisa.

Evidencia:

- `packages/database/prisma/schema.prisma:159-170`
- `packages/core/src/application/services/pix-merchant-city.ts:1-9`
- `packages/core/src/application/use-cases/create-payment.use-case.ts:265`
- `packages/core/src/application/use-cases/create-payment-link.use-case.ts:82`
- `apps/web/src/app/features/dashboard/pages/settings/settings.ts`

Subtasks:

- [ ] P1.9.1 Adicionar `city` em Store (opcional) e PATCH autenticado de `name` + `city`.
  - Problema: nao ha campo nem mutacao.
  - Solucao: migration + use case; slug/fee/settlement/aprovacao continuam protegidos.
  - Validacao: spec de PATCH; fee no body e ignorado ou 422.
- [ ] P1.9.2 Create payment / Payment Link usam `resolvePixMerchantCity(store.city)`.
  - Problema: fallback escondido no meio do metodo.
  - Solucao: cidade da store; sem cidade, `SAO PAULO` documentado.
  - Validacao: spec com store em outra cidade.
- [ ] P1.9.3 Settings edita nome e cidade; continua read-only em taxa e liquidacao.
  - Problema: a tela so da refresh.
  - Solucao: form minimo; sem dialog de revisao (P1.7).
  - Validacao: fluxo dashboard grava e o QR seguinte usa a cidade.

Done Criteria:

- [ ] EMV deixa de estar hardcoded nos dois creates.
- [ ] Merchant consegue nome publico e cidade; nao edita fee.

### P1.10 Payment Link publico coleta pagador

Status: `nao iniciado`

Problema: checkout session pede nome/email/documento. `/pay/:token` so confirma/falha o Pix. `PayPaymentLinkUseCase.createAttempt` grava `Payment` sem `customerId`.

Impacto: o caminho no-code nao alimenta Clientes nem historico. O dashboard de customers fica vazio para quem so usa link.

Evidencia:

- `packages/core/src/application/use-cases/pay-payment-link.use-case.ts:126-143`
- `apps/checkout/src/components/...` (`PaymentLinkPage` vs `CheckoutPage`)

Subtasks:

- [ ] P1.10.1 Public pay aceita customer (mesmo contrato minimo do fulfill) e associa ao Payment.
  - Problema: tentativa sem titular.
  - Solucao: resolver/criar customer na mesma transacao do attempt, no padrao do checkout.
  - Validacao: spec de pay com documento cria customer da store; payment.customerId preenchido.
- [ ] P1.10.2 Checkout `/pay/:token` coleta os campos antes de simular.
  - Problema: a UI nao pede dados.
  - Solucao: o mesmo bloco de identificacao do hosted checkout.
  - Validacao: pay sem documento falha; com documento, customer aparece no dashboard.

Done Criteria:

- [ ] Link pago tem customer.
- [ ] Clientes/historico veem o caminho de Payment Link.

## P2 - Acabamento

### P2.1 Copy do checkout como simulador

Status: `nao iniciado`

Problema: `apps/checkout` metadata diz "Pagamento Pix seguro". O produto nao processa Pix real.

Impacto: comprador de demo le uma promessa que `docs/PRODUCT.md` proibe.

Evidencia:

- `apps/checkout/src/app/layout.tsx:7-9`
- `docs/PRODUCT.md` (limites nao negociaveis)

Subtasks:

- [ ] P2.1.1 Trocar title/description para linguagem de checkout/simulacao, sem "seguro" / adquirencia.
  - Validacao: `rg "Pix seguro" apps/checkout` vazio.

Done Criteria:

- [ ] Checkout nao afirma pagamento real nem "seguro".

### P2.2 Dead code e `as never` que a passagem anterior nao varreu

Status: `nao iniciado`

Problema: `apps/api/src/infra/queues/` vazio. `ApiKeyGeneratorService` e `ICreateMerchant` sem caller. `CreatePaymentLinkUseCase` casta repos `as never` porque cria fora do UoW. `DetectAnomaliesUseCase` ainda injeta `IPaymentRepository` e ignora.

Impacto: o mapa mental do monorepo mente; o create de link foge do padrao transacional sem motivo novo.

Evidencia:

- `apps/api/src/infra/queues/`
- `apps/api/src/infra/services/api-key-generator.service.ts`
- `apps/api/src/infra/interfaces/merchant.interface.ts`
- `packages/core/src/application/use-cases/create-payment-link.use-case.ts:55-59`
- `packages/core/src/application/use-cases/detect-anomalies.use-case.ts:31-40`

Subtasks:

- [ ] P2.2.1 Apagar adapters/pastas mortas da API.
  - Validacao: arquivos sem import somem.
- [ ] P2.2.2 Create de Payment Link usa UoW (ja tem product no bag) ou deixa de castear `as never`.
  - Validacao: spec de create link continua; sem `as never` no use case.
- [ ] P2.2.3 Stub de antifraude nao injeta repositorio que nao usa.
  - Validacao: construtor so o que o `execute` le.

Done Criteria:

- [ ] API nao tem infra oca nova.
- [ ] Create de link nao mente o tipo do repo.

### P2.3 Paginar Payment Link no SQL

Status: `nao iniciado`

Problema: o repositorio de link carrega todas as linhas da store para calcular stats e pagina em memoria.

Impacto: store com muitos links fica lenta sem o operador ver.

Evidencia:

- `packages/infrastructure/src/repositories/payment-link.repository.ts` (listagem sem `skip/take` SQL)

Subtasks:

- [ ] P2.3.1 Paginar no Prisma; agregar stats sem materializar a lista inteira.
  - Validacao: spec/repo com N > page size nao le tudo para devolver uma pagina.

Done Criteria:

- [ ] Listagem autenticada de links nao faz full scan da store.

### P2.4 Um `requestId` e trilha de alert

Status: `nao iniciado`

Problema: pino `genReqId` e `getOrCreateRequestId` sao duas fabricas. Alert processor nao carrega `requestId`. Linhas de sucesso/fail do webhook processor omitem `deliveryId`.

Impacto: cruzar HTTP -> outbox -> alert/DLQ exige adivinhar.

Evidencia:

- `apps/api/src/app.module.ts` (`genReqId`)
- `apps/api/src/common/request-id.ts`
- `apps/worker/src/modules` (alert/webhook processors)

Subtasks:

- [ ] P2.4.1 Uma funcao so gera/valida `X-Request-ID` para pino, interceptor e outbox.
  - Validacao: spec do request-id; header e `req.id` iguais.
- [ ] P2.4.2 Alert e webhook processor logam `requestId` / `outboxEventId` / `deliveryId` quando existirem.
  - Validacao: assert nos logs de processor/DLQ.

Done Criteria:

- [ ] Uma regra de request id na API.
- [ ] Alert deixa de nascer sem trilha.

## Public APIs / Interfaces Mentioned By This Goal

- Mutacoes financeiras (confirm/expire/fail/release/refund/dev) recusam agregado LIVE mesmo com request TEST.
- `ERROR_CODE_MAP` passa a ser o catalogo fechado de `DomainError`.
- `@CurrentStore()` vira o unico jeito de ler store em controller autenticado.
- `GET /payments/:id/timeline` honra environment.
- Fulfill e pay publico passam a ser replay-safe.
- `POST /withdrawals` (e refund, se o mesmo recorte) deixa de aceitar API key sem escopo.
- `PATCH` de store aceita `name` e `city`; fee/settlement continuam imutaveis.
- Public pay de Payment Link passa a exigir customer.
- README da API deixa de contradizer `docs/CURRENT_STATE.md`.

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
- Payment Link com `items` / catalogo.
- CRUD de checkout session no dashboard.
- Settings mutavel de fee, settlement, aprovacao ou "revisao comercial".
- OAuth GitHub, reset de senha por email, notificacoes in-app, antifraude real.
- Marketplace, split, multi-seller.
- Estoque, variantes, tags, storefront.
- Domain events in-process; reescrita DDD das entidades anêmicas.
- Smoke Docker no PR (decisao da goal anterior / `TARGET_ARCHITECTURE`).

## Assumptions

- Caminho escolhido: `/GOAL.md` como unico tracker desta goal; a anterior vive em `docs/goals/2026-08-18-architecture-hardening.md`.
- Ordenacao: criticidade (P0 → P1 → P2); dentro da faixa, risco primeiro.
- Recorte: fechar o que a passagem de 2026-08-18 deixou pela metade e parar de mentir no workspace; nao abrir produto novo.
- P1.6 assume authz minima (JWT-only ou um scope `withdrawals`), nao um sistema de permissoes.
- P1.2 assume Account unico por store ate haver PRD de ledger dual.
- P1.8 assume que Payment Link amount-only continua correto; o bug e o copy, nao a ausencia de items.
