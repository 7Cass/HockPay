# Hockpay - Goal

Source repo: `/Users/jpcass/Documents/2026/hockpay`
Last reviewed: `2026-08-18`
Ordering: criticidade primeiro
Scope: divida aberta da revisao de arquitetura de 2026-08-18

Este arquivo e o tracker executavel da goal atual. Cada macro item e uma unidade de planejamento; as checkboxes em `Subtasks` sao as unidades executaveis de implementacao e validacao.

Uma passagem anterior (2026-05-23) ja fechou concorrencia de Payment Link, locks de transicao, UoW de create/cancel, health do worker, lint/format no CI, Redis unificado, SSRF literal, refund no dashboard e docs de produto. Esta goal cobre o que a revisao de 2026-08-18 ainda viu aberto.

## Status Legend

- `nao iniciado`
- `em planejamento`
- `em implementacao`
- `em validacao/hardening`
- `concluido`

## Priority Legend

- `P0`: risco de integridade, seguranca, credito duplicado, isolamento TEST/LIVE quebrado, invariante financeira que o schema pode perder, ou erro de negocio que vira 500.
- `P1`: confiabilidade operacional, contrato HTTP/erro, duplicacao do caminho financeiro, CI/docs, stubs que mentem, UX operacional material.
- `P2`: acabamento, stencil de geracao, anemicidade, lint/test de frontend e clareza.

## Intake Snapshot

- Branch da review: `main`.
- Fonte: leitura de `packages/core`, `packages/infrastructure`, `packages/database`, `apps/api`, `apps/worker`, `apps/web`, `apps/checkout` e docs canonicos.
- Docs canonicos considerados: `README.md`, `docs/CURRENT_STATE.md`, `docs/PRODUCT.md`, `docs/DATA_MODEL.md`, `docs/RUNBOOK.md`, `docs/TARGET_ARCHITECTURE.md`.
- Decisao de recorte: nao reescrever o dominio como DDD profundo; apertar o desenho que ja existe (transacao, ledger, outbox, politicas, auth).

## P0 - Integridade, Auth e Isolamento

### P0.1 Unificar erros de dominio para o filter HTTP

Status: `concluido`

Problema: `DomainExceptionFilter` so captura `DomainError`. Entidades e use cases posteriores jogam `Error` generico, e o cliente recebe 500 em violacao de regra de negocio. `InvalidBalanceError` existe, nao estende `DomainError` e nao e usado.

Impacto: saldo insuficiente, refund invalido, checkout expirado, Payment Link inexistente e titularidade de bank account vazam como erro interno. O catalogo de erros so protege o caminho feliz antigo.

Evidencia:

- `apps/api/src/common/filters/domain-exception.filter.ts:27-36`
- `packages/core/src/domain/errors/invalid-balance.error.ts:5-11`
- `packages/core/src/domain/entities/account.entity.ts:106,128,142,156,171,186,198`
- `packages/core/src/domain/entities/payment.entity.ts:344,347`
- `packages/core/src/domain/entities/withdrawal.entity.ts:139,151,162,177`
- `packages/core/src/domain/entities/pix-charge.entity.ts:90`
- `packages/core/src/application/use-cases/fulfill-checkout-session.use-case.ts:46,54,57,71,75`
- `packages/core/src/application/use-cases/get-checkout-session.use-case.ts:51,56`
- `packages/core/src/application/use-cases/create-store.use-case.ts:74`
- `packages/core/src/application/use-cases/confirm-payment.use-case.ts:150`
- `packages/core/src/application/use-cases/create-bank-account.use-case.ts:29`
- `packages/core/src/application/use-cases/delete-bank-account.use-case.ts:16`

Subtasks:

- [x] P0.1.1 Fazer `InvalidBalanceError` estender `DomainError` e usa-lo em `Account`.
  - Problema: o tipo ja existe e foi abandonado; Account joga `Error`.
  - Solucao: herdar `DomainError`, mapear o code no filter, trocar todos os `throw new Error` de saldo.
  - Validacao: teste de entidade prova o tipo; e2e/controller prova status 4xx, nao 500.
- [x] P0.1.2 Trocar `Payment.addRefund`, `Withdrawal`, `PixCharge.markPaid`, `Refund.process` e `CheckoutSession.fulfill` para erros tipados do catalogo.
  - Problema: invariantes de entidade nao atravessam o filter.
  - Solucao: reusar `InvalidRefundAmountError`, `InvalidWithdrawalStatusError`, `PixChargeNotOpenError` ou criar o tipo que faltar.
  - Validacao: specs de entidade/use case esperam o tipo de dominio.
- [x] P0.1.3 Trocar `throw new Error` dos use cases listados por erros do catalogo (`StoreNotFoundError`, `MerchantNotFoundError`, erros de checkout).
  - Problema: o mesmo fato ja tem tipo em outro fluxo e aqui foi escrito como string.
  - Solucao: reusar o tipo existente; so criar tipo novo se o fato ainda nao existir.
  - Validacao: `rg "throw new Error" packages/core/src` sem matches de producao (specs podem ficar).
- [x] P0.1.4 Confirmar que `getStatusCodeForError` cobre os codes novos/antigos usados acima.
  - Problema: `DomainError` sem mapping ainda pode cair em 500.
  - Solucao: completar `apps/api/src/common/constants/error-codes.ts`.
  - Validacao: teste do filter/codes para cada code tocado.

Done Criteria:

- [x] Violacao de saldo, refund, checkout e store vira 4xx com `error.code`.
- [x] Entidades financeiras nao jogam `Error` generico.
- [x] `InvalidBalanceError` ou some ou entra no catalogo de verdade.

### P0.2 Fechar CombinedAuth: store obrigatorio, precedencia e vazamento

Status: `concluido`

Problema: JWT sem `storeId` autentica e devolve `true`; payment/webhook depois jogam `Error('Store ID not found in request')` e viram 500. Cookie JWT ganha de `Authorization: Bearer hk_...`. Falhas de verify vazam a mensagem crua no 401.

Impacto: dashboard sem loja atual quebra mutacoes com 500; no mesmo origin a sessao TEST silencia uma API key LIVE; clientes recebem detalhe interno de JWT.

Evidencia:

- `apps/api/src/modules/auth/guards/combined-auth.guard.ts:49-77,88-131`
- `apps/api/src/modules/payment/payment.controller.ts:92-97`
- `apps/api/src/modules/withdrawal/withdrawal.controller.ts` (referencia positiva: `@CurrentStore()`)

Subtasks:

- [x] P0.2.1 Recusar JWT sem `storeId` com 401/403 no guard, antes do controller.
  - Problema: auth "passa" e o 500 nasce no handler.
  - Solucao: exigir store em rotas que precisam de store, ou um decorator/guard `RequireStore` usado de forma consistente.
  - Validacao: teste do guard com payload sem `storeId`.
- [x] P0.2.2 Definir precedencia explicita quando cookie JWT e API key existem juntos.
  - Problema: cookie sempre vence e esconde a key LIVE.
  - Solucao: documentar e implementar uma regra (recomendado: API key no `Authorization` vence quando presente; JWT fica para o dashboard).
  - Validacao: teste com os dois headers; a environment da request e a da key.
- [x] P0.2.3 Parar de concatenar `JWT: <verify message>` no 401.
  - Problema: detalhe do verifier vaza.
  - Solucao: mensagem estavel (`Authentication required` / `Invalid credentials`); detalhe so no log.
  - Validacao: teste do guard nao expoe texto de `JsonWebTokenError`.
- [x] P0.2.4 Padronizar extracao de store: `@CurrentStore()` em vez de `(req as any)?.store?.id` nos controllers financeiros.
  - Problema: cada controller reimplementa o contrato do guard.
  - Solucao: o mesmo decorator de withdrawal em payment, refund, webhook, payment-link autenticado.
  - Validacao: controllers tocados nao leem `req as any` para store.

Done Criteria:

- [x] JWT sem store nao autentica rota que exige store.
- [x] API key no `Authorization` nao e silenciada por cookie.
- [x] 401 nao vaza mensagem de verify.

### P0.3 Isolar TEST/LIVE nas leituras

Status: `concluido`

Problema: JWT forca `environment = TEST`, mas list/get de payments (e varias listas irmas) nao filtram `environment`. A coluna existe no schema; a query nao usa. Isolamento hoje e "o cliente usou a key certa".

Impacto: sessao do dashboard pode ler pagamentos LIVE da mesma store. API key TEST pode listar cobrancas LIVE se o repositorio nao restringir.

Evidencia:

- `apps/api/src/modules/auth/guards/combined-auth.guard.ts:63-64`
- `packages/core/src/application/use-cases/list-payments.use-case.ts:13-53`
- `packages/database/prisma/schema.prisma` (`Payment.environment`, `Product` ja filtra environment)
- Contraste: `list-products.use-case.ts:7,29` ja recebe `environment`

Subtasks:

- [x] P0.3.1 Passar `environment` em `ListPaymentsUseCase` / `GetPaymentUseCase` e filtrar no repositorio.
  - Problema: list/get ignoram o ambiente da request.
  - Solucao: o mesmo recorte de Products: input + query Prisma.
  - Validacao: spec prova que TEST nao devolve linha LIVE.
- [x] P0.3.2 Aplicar o mesmo recorte nas listas operacionais que carregam dinheiro ou cobranca: Payment Links, checkout sessions, receipts, refunds, withdrawals, customer history.
  - Problema: fechar so payments deixa o furo nas telas vizinhas.
  - Solucao: auditar cada `list-*` / `get-*` financeiro e filtrar onde o schema tem `environment`.
  - Validacao: matriz feature x filtro no item; teste por repositorio ou use case.
- [x] P0.3.3 Para entidades sem coluna de environment (`Customer`, `Account`, `WebhookConfig`), documentar a regra ou adicionar o recorte se a leitura vazar dado LIVE.
  - Problema: nem tudo tem a coluna; inventar filtro errado e pior.
  - Solucao: decidir por entidade e registrar em `docs/CURRENT_STATE.md`.
  - Validacao: doc diz o que e isolado e o que e compartilhado por store.

Done Criteria:

- [x] JWT TEST nao lista nem detalha payment LIVE.
- [x] API key TEST/LIVE so ve o proprio environment nas entidades que tem a coluna.
- [x] Excecoes (customer/account/webhook) estao documentadas.

### P0.4 Declarar no Prisma o indice parcial de um pago por PixCharge

Status: `concluido`

Problema: a unicidade de um payment `CONFIRMED`/`RELEASED` por `pix_charge_id` vive so na migration SQL. `schema.prisma` tem apenas `@@index([pixChargeId])`. `prisma db push` / regenerate pode apagar o indice.

Impacto: a defesa de banco contra credito duplicado some sem o Prisma reclamar.

Evidencia:

- `packages/database/prisma/migrations/20260523093000_unique_paid_payment_per_pix_charge/migration.sql:1-4`
- `packages/database/prisma/schema.prisma:394-399`

Subtasks:

- [x] P0.4.1 Representar o indice parcial no schema Prisma (preview de partial indexes, ou comentario + check no CI que o indice existe).
  - Problema: o schema nao e a fonte da invariante.
  - Solucao: se o Prisma da versao atual nao expressar `WHERE`, adicionar teste/CI que inspeciona `pg_indexes` e um comentario obrigatorio no model.
  - Validacao: `prisma migrate diff` nao propoe drop do indice; teste de infra tenta segundo CONFIRMED e falha.
- [x] P0.4.2 Registrar a invariante em `docs/DATA_MODEL.md` ao lado de Payment/PixCharge.
  - Problema: so quem leu a migration sabe.
  - Solucao: uma linha no doc canonico.
  - Validacao: doc cita o indice e o fato de falhas/pending serem permitidos.

Done Criteria:

- [x] Fonte de schema e migration concordam.
- [x] Segundo payment pago na mesma charge continua impossivel no banco.

## P1 - Contrato, Caminho Financeiro e Operacao

### P1.1 Separar snapshot de Payment do read model de tentativa

Status: `concluido`

Problema: `Payment` nao tem `paymentLinkId`, `paymentOrigin`, `attemptNumber`, `attemptCount`, `isLatestAttempt`. `PaymentObject` tem. Esses campos nascem em `enrichPaymentAttempts` e o mesmo tipo serve de snapshot da entidade, item de lista e payload publico do checkout.

Impacto: o contrato do aggregate vaza query/UI. Qualquer consumidor de `toObject()` precisa saber quais campos sao persistidos e quais sao derivados.

Evidencia:

- `packages/core/src/domain/entities/payment.entity.ts:372-403,469-478`
- `packages/core/src/application/services/payment-attempt-context.service.ts`
- `packages/infrastructure/src/repositories/payment-link.repository.ts:324-334`
- `apps/web/src/app/core/services/payment.service.ts`

Subtasks:

- [x] P1.1.1 Criar um tipo de read model (`PaymentAttemptView` ou equivalente) com os campos derivados.
  - Problema: um tipo, tres empregos.
  - Solucao: `PaymentObject` volta a ser so o snapshot de `toObject()`; listas de link/checkout usam o view.
  - Validacao: `PaymentObject` no core nao declara os campos extras.
- [x] P1.1.2 Parar a duplicacao do enrich no repositorio de Payment Link.
  - Problema: a mesma derivacao existe em application e infra.
  - Solucao: um modulo so, chamado pelos use cases de leitura.
  - Validacao: um unico ponto calcula attempt number.
- [x] P1.1.3 Ajustar DTOs da API e tipos do dashboard para o view, sem quebrar o JSON publico atual se ainda for necessario.
  - Problema: o wire format ja entrega esses campos.
  - Solucao: o HTTP pode continuar igual; o tipo de dominio nao carrega o view.
  - Validacao: smoke/payment-link e dashboard de tentativas continuam renderizando.

Done Criteria:

- [x] Entidade/snapshot nao conhecem attempt number.
- [x] Read model tem dono unico.
- [x] Contrato HTTP de lista/detalhe de link permanece utilizavel.

### P1.2 Extrair o miolo de confirm e reusar no Payment Link

Status: `concluido`

Problema: `PayPaymentLinkUseCase` injeta `ConfirmPaymentUseCase` e nao chama. Inlinha ledger, recibo e outbox para nao aninhar `$transaction`.

Impacto: a regra financeira mais importante vive em dois lugares. Um fix de recibo/lock/outbox em confirm nao chega no pay publico.

Evidencia:

- `packages/core/src/application/use-cases/pay-payment-link.use-case.ts:42-47`
- `packages/core/src/application/use-cases/confirm-payment.use-case.ts`
- `apps/api/src/modules/payment-link/payment-link.module.ts` (ainda constroi Confirm)

Subtasks:

- [x] P1.2.1 Extrair uma funcao/servico de aplicacao `confirmPaymentInTransaction(repos, input)` com lock, charge, account, ledger, receipt e outbox.
  - Problema: o use case e o pay link repetem o miolo.
  - Solucao: os dois chamam o miolo dentro do UoW ja aberto; ninguem chama `unitOfWork.execute` por dentro do outro.
  - Validacao: `ConfirmPaymentUseCase` e `PayPaymentLinkUseCase` nao duplicam a escrita de Transaction/Receipt/Outbox.
- [x] P1.2.2 Remover a injecao morta de `ConfirmPaymentUseCase` no pay link.
  - Problema: o modulo mente sobre a dependencia.
  - Solucao: o construtor so recebe o que usa.
  - Validacao: `rg ConfirmPaymentUseCase packages/core/src/application/use-cases/pay-payment-link.use-case.ts` vazio.

Done Criteria:

- [x] Um unico miolo credita saldo e emite recibo/outbox.
- [x] Nao ha `$transaction` aninhado.
- [x] Specs de confirm e payment-link continuam passando, inclusive corrida.

### P1.3 Colocar Product no UoW e criar checkout session na transacao

Status: `concluido`

Problema: `ITransactedRepositories` nao expoe `productRepository`. `CreateCheckoutSessionUseCase` resolve itens e persiste a session fora de transacao.

Impacto: um produto pode ser arquivado ou ter preco alterado entre o resolve e o save. O snapshot da session pode mentir.

Evidencia:

- `packages/core/src/domain/repositories/unit-of-work.interface.ts:21-38`
- `packages/infrastructure/src/repositories/unit-of-work.ts:39-59`
- `packages/core/src/application/use-cases/create-checkout-session.use-case.ts:48-84`
- `packages/core/src/application/services/line-item-resolver.service.ts:26,63`

Subtasks:

- [x] P1.3.1 Adicionar `productRepository` a `ITransactedRepositories` e a implementacao Prisma.
  - Problema: catalogo nao entra na transacao financeira/comercial.
  - Solucao: o mesmo padrao dos outros repos.
  - Validacao: `transactional-repositories.spec.ts` cobre product.
- [x] P1.3.2 Mover resolve + save da checkout session para `unitOfWork.execute`.
  - Problema: leitura de produto e insert da session nao sao atomicos.
  - Solucao: `LineItemResolver` recebe o repo transacionado; save da session no mesmo callback.
  - Validacao: teste de corrida/arquivo de produto entre resolve e save, ou teste de rollback.

Done Criteria:

- [x] Session com `items` nasce na mesma transacao do lookup dos produtos.
- [x] Product arquivado no meio do create nao deixa session com snapshot velho.

### P1.4 Fechar janela de DNS rebinding no webhook HTTP client

Status: `concluido`

Problema: a policy resolve DNS e bloqueia IP privado, depois `fetch(url)` conecta de novo pelo hostname. Um TTL curto pode virar IP interno entre o check e o connect.

Impacto: webhook configurado com hostname publico ainda pode alcançar rede privada.

Evidencia:

- `packages/core/src/application/services/webhook-url-policy.service.ts`
- `packages/infrastructure/src/services/webhook-http-client.service.ts`

Subtasks:

- [x] P1.4.1 Conectar no IP publico ja resolvido, com SNI/Host do hostname original, ou revalidar o peer address antes de enviar o body.
  - Problema: TOCTOU entre lookup e `fetch`.
  - Solucao: pin do destino; se nao for viavel com `fetch`, usar cliente que exponha o socket.
  - Validacao: teste com resolver mockado que muda o IP depois do check.
- [x] P1.4.2 Manter a matriz ja existente (redirect, metadata IP, localhost com NODE_ENV unset, HTTPS publico).
  - Problema: o harden de P1.4 antigo nao pode regredir.
  - Solucao: estender `webhook-http-client.service.spec.ts`.
  - Validacao: suite de infrastructure passa.

Done Criteria:

- [x] Destino efetivo da conexao e o IP validado.
- [x] Redirect continua revalidado por hop.

### P1.5 Um filter so: controllers financeiros finos

Status: `concluido`

Problema: Payment, Payment Link, Product e Webhook remapam `DomainError` na mao. Payment ainda mapeia por `error.name`. Withdrawal ja e o modelo fino.

Impacto: status/payload divergem do `DomainExceptionFilter`; handlers incham; erro novo precisa de patch em N controllers.

Evidencia:

- `apps/api/src/modules/payment/payment.controller.ts:155-188,346`
- `apps/api/src/modules/payment-link/payment-link.controller.ts:238`
- `apps/api/src/modules/product/product.controller.ts:131`
- `apps/api/src/common/filters/domain-exception.filter.ts`

Subtasks:

- [x] P1.5.1 Remover `try/catch` de traducao de dominio nos controllers que o filter ja cobre.
  - Problema: dois tradutores.
  - Solucao: deixar o filter; controller so monta input e DTO de saida.
  - Validacao: specs de controller ainda veem o status certo via filter.
- [x] P1.5.2 Parar de mapear por `error.name` no simulate.
  - Problema: rename quebra o HTTP sem o type checker ver.
  - Solucao: `instanceof` no tipo de dominio, ou nada (filter).
  - Validacao: teste de simulate 404/422 nao usa string do name.

Done Criteria:

- [x] Payment/Payment Link/Product nao tem `mapError` local para `DomainError`.
- [x] Payload de erro e o do filter.

### P1.6 Worker: settlement e expiration param de varrer Prisma

Status: `concluido`

Problema: `settlement.job` e `payment-expiration.job` fazem `prisma.payment.findMany` e depois chamam o use case. O resto do worker ja passa por repositorio.

Impacto: jobs fogem do seam; mudanca de mapeamento/lock no repo nao chega no cron. Settlement esta limitado a 100 payments/store/noite no scan cru.

Evidencia:

- `apps/worker/src/jobs/settlement.job.ts:71-78`
- `apps/worker/src/jobs/payment-expiration.job.ts:53-59`

Subtasks:

- [x] P1.6.1 Expor no repositorio de Payment os queries que os crons precisam (`findConfirmedForSettlement`, `findPendingExpired`).
  - Problema: o job conhece colunas Prisma.
  - Solucao: porta no core + implementacao em infrastructure.
  - Validacao: job nao importa Prisma client.
- [x] P1.6.2 Documentar o teto de settlement e o fallback dual (fila BullMQ + cron) em `docs/RUNBOOK.md`.
  - Problema: o limite 100/store e invisivel.
  - Solucao: uma linha no runbook.
  - Validacao: runbook cita o teto e o fallback.

Done Criteria:

- [x] Jobs de settlement/expiration nao importam Prisma.
- [x] Expire via fila e via cron continuam coexistindo como fallback.

### P1.7 Anti-fraud: logar stub ou remover o cron

Status: `concluido`

Problema: `DetectAnomaliesUseCase` devolve `anomalies: []` e `scannedPayments: 0`. O job horario loga `"Anti-fraud scan completed: no anomalies detected"`. README ja chama de stub; o log mente.

Impacto: operacao acredita que ha varredura. Metodo privado ainda fala em ML.

Evidencia:

- `packages/core/src/application/use-cases/detect-anomalies.use-case.ts:65-94`
- `apps/worker/src/jobs/anti-fraud.job.ts:33-54`
- `packages/core/README.md:54`

Subtasks:

- [x] P1.7.1 Ou o job loga explicitamente que o scan e stub, ou o cron some ate existir implementacao.
  - Problema: log de producao mente.
  - Solucao: preferir remover o registro do scheduler e deixar o use case sem job; se manter, `logger.warn('Anti-fraud stub: scan not implemented')`.
  - Validacao: nenhum log afirma "no anomalies detected" com `scannedPayments === 0` por desenho.
- [x] P1.7.2 Remover o metodo privado morto e o comentario de machine learning.
  - Problema: gancho de IA sem caller.
  - Solucao: apagar.
  - Validacao: arquivo so tem o que o execute faz.

Done Criteria:

- [x] Nenhum log operacional afirma scan real.
- [x] Docs e runtime concordam que e stub.

### P1.8 Trazer Payment Link e checkout para o catalogo DomainError

Status: `concluido`

Problema: `PaymentLinkNotFoundError` e `PaymentLinkInvalidExpirationError` (e equivalentes de checkout) estendem `Error` e nascem dentro de use case. O controller de link precisa de `mapError` local.

Impacto: mesmo depois de P0.1/P1.5, esses fluxos continuam especiais.

Evidencia:

- `packages/core/src/application/use-cases/get-payment-link.use-case.ts:4-9`
- `packages/core/src/application/use-cases/create-payment-link.use-case.ts` (erros locais)
- `packages/core/src/application/use-cases/open-payment-link.use-case.ts`
- `apps/api/src/modules/payment-link/payment-link.controller.ts:238`

Subtasks:

- [x] P1.8.1 Mover os erros de Payment Link/checkout para `packages/core/src/domain/errors`, estendendo `DomainError`.
  - Problema: tipo HTTP-only escondido no use case.
  - Solucao: o mesmo padrao de `PaymentNotFoundError`.
  - Validacao: export no `packages/core/src/index.ts` e code no `error-codes.ts`.
- [x] P1.8.2 Apagar `mapError` do controller de Payment Link depois que o filter cobrir os codes.
  - Problema: traducao local.
  - Solucao: depende de P1.5; este item fecha o catalogo que o filter precisa.
  - Validacao: specs de controller/link passam sem mapper local.

Done Criteria:

- [x] Not found / unavailable / invalid expiration de link e checkout sao `DomainError`.
- [x] Controller de link nao traduz dominio.

### P1.9 Estender idempotencia transacional

Status: `concluido`

Problema: so `POST /payments` e `POST /withdrawals` passam por `TransactionalIdempotencyService`. Create de Payment Link, checkout session e refund sao mutacoes financeiras/comerciais sem a mesma reserva.

Impacto: retry de cliente cria link/session/refund duplicado.

Evidencia:

- `apps/api/src/common/idempotency/transactional-idempotency.service.ts`
- `apps/api/src/modules/payment/payment.controller.ts:83`
- `apps/api/src/modules/refund/refund.controller.ts`
- `apps/api/src/modules/payment-link/payment-link.controller.ts`
- `apps/api/src/modules/checkout-session/checkout-session.controller.ts`

Subtasks:

- [x] P1.9.1 Exigir `Idempotency-Key` e reserva transacional em create de Payment Link, checkout session e refund.
  - Problema: mutacao sem fingerprint.
  - Solucao: o mesmo decorator + `executeInTransaction` ja usado em payment.
  - Validacao: replay devolve o mesmo body; key conflitante vira 409.
- [x] P1.9.2 Documentar quais mutacoes exigem a key em `docs/CURRENT_STATE.md` / README da API.
  - Problema: o contrato fica so no codigo.
  - Solucao: tabela curta feature → header obrigatorio.
  - Validacao: doc lista payments, withdrawals, links, checkout, refunds.

Done Criteria:

- [x] Retry com a mesma key nao cria segundo link/session/refund.
- [x] Dashboard de refund ja gera key; o backend passa a honrar do mesmo jeito que payment.

### P1.10 Reconciliar docs de CI com o workflow real

Status: `concluido`

Problema: `docs/CURRENT_STATE.md`, `README.md` e `docs/RUNBOOK.md` ainda dizem que o CI nao roda lint nem smokes. O workflow roda `lint:check` e `format:check` em todo PR. Smoke minimo roda em cron/`workflow_dispatch`, nao no PR. `docs/TARGET_ARCHITECTURE.md` ainda fala em "CI pode ganhar lint".

Impacto: mantenedor toma decisao em cima de doc atrasado.

Evidencia:

- `docs/CURRENT_STATE.md` (secao CI e Smokes)
- `README.md` (secao CI)
- `.github/workflows/ci.yml:50-54,140-143`
- `docs/TARGET_ARCHITECTURE.md:40`

Subtasks:

- [x] P1.10.1 Atualizar README, CURRENT_STATE, RUNBOOK e TARGET_ARCHITECTURE com o que o `ci.yml` faz de verdade.
  - Problema: a frase aponta para o passado.
  - Solucao: lint/format no PR; testes core/infra/api/worker + e2e; smoke `p0,payment-link` so scheduled/manual.
  - Validacao: `rg "Nao roda lint nem smokes" docs README.md` vazio.
- [x] P1.10.2 Declarar que lint do workspace hoje e so API/worker, e que web/checkout/demo nao entram no gate.
  - Problema: "lint:check na raiz" sugere monorepo inteiro.
  - Solucao: uma linha honesta; o gate de frontend e P2.6.
  - Validacao: CURRENT_STATE lista quais packages o CI cobre.

Done Criteria:

- [x] Docs de CI batem com `.github/workflows/ci.yml`.
- [x] Ninguem le que lint "ainda nao roda".

### P1.11 Decidir o destino de `Money`

Status: `concluido`

Problema: `Money` esta definido, exportado e sem nenhum import fora do proprio arquivo. Nao aceita `0`, entao nao representa saldo, taxa nem `totalRefunded`. O README do core ja admite que aggregates usam `number`.

Impacto: o VO sugere um modelo que nao existe. Quem for "passar a usar Money" quebra Account no create.

Evidencia:

- `packages/core/src/domain/value-objects/money.vo.ts:21-26,90-98`
- `packages/core/README.md:30`
- `packages/core/src/domain/entities/account.entity.ts:33-35`

Subtasks:

- [x] P1.11.1 Escolher um dos dois: (A) redesenhar `Money` para aceitar zero, currency tipada e usa-lo em Account/Payment/Withdrawal, ou (B) remover o VO e o export.
  - Problema: estado pela metade e pior que as duas pontas.
  - Solucao: B e o caminho curto e honesto com o runtime atual; A so vale se Account/Payment forem convertidos no mesmo PR.
  - Validacao: ou `Money` e usado nos aggregates financeiros, ou nao existe mais no `index.ts`.
- [x] P1.11.2 Se a escolha for B, atualizar README do core e qualquer mencao em docs.
  - Problema: doc nao pode continuar falando de VO morto como se fosse pendencia.
  - Solucao: "valores sao `number` em centavos; invariantes ficam em policies/entidades".
  - Validacao: README deixa de vender `Money` como tipo central.

Done Criteria:

- [x] Nao sobra VO morto no pacote publico.
- [x] Centavos continuam inteiros no schema.

### P1.12 Invariantes de quantia em Payment e FeePolicy

Status: `concluido`

Problema: `Payment.create` nao valida `amount === fee + netAmount` nem que os tres sao inteiros nao negativos. `FeePolicy.calculate` pode devolver `netAmountInCents` negativo se taxa percentual + fixa passar do valor.

Impacto: ledger nasce incoerente se um caller descuidar. Store com fee alta demais gera net negativo e `Account.addToPending` aceita.

Evidencia:

- `packages/core/src/domain/entities/payment.entity.ts:89-117`
- `packages/core/src/application/services/fee-policy.service.ts:64-84`
- `packages/core/src/domain/entities/account.entity.ts:93-97`

Subtasks:

- [x] P1.12.1 Validar em `Payment.create` inteiros, `amount > 0`, `fee >= 0`, `netAmount >= 0` e `amount === fee + netAmount`.
  - Problema: o aggregate aceita qualquer trio.
  - Solucao: invariante no `create`; `reconstitute` confia no persistido ou tambem valida.
  - Validacao: spec de entidade com os casos invalidos.
- [x] P1.12.2 Fazer `FeePolicy` recusar fee que zera ou inverte o net, com erro de dominio.
  - Problema: a conta e so aritmetica.
  - Solucao: se `feeInCents >= amountInCents`, erro tipado.
  - Validacao: spec da policy.

Done Criteria:

- [x] Nao e possivel persistir Payment com net negativo via `create`.
- [x] Fee maior que o amount nao chega no ledger.

### P1.13 API so aceita PIX enquanto nao houver processador

Status: `concluido`

Problema: o DTO de create payment aceita `PaymentMethod` completo. O use case sempre gera QR Pix e grava o metodo pedido. Schema e enum tem `CREDIT_CARD`, `BOLETO`, `DEBIT_CARD` sem fluxo.

Impacto: integrador acha que criou cobranca de cartao; o runtime emitiu Pix.

Evidencia:

- `apps/api/src/modules/payment/dtos/create-payment.dto.ts:100`
- `packages/core/src/domain/entities/payment.entity.ts:11-16`
- `packages/core/src/application/use-cases/create-payment.use-case.ts:253-292`
- `docs/CURRENT_STATE.md` (metodos card/boleto/debito = modelado/parcial)

Subtasks:

- [x] P1.13.1 Recusar no DTO e/ou no use case qualquer metodo diferente de `PIX` com 422 e code claro.
  - Problema: o contrato HTTP promete metodo que nao processa.
  - Solucao: `@IsEnum` restrito ou validacao no use case; default PIX.
  - Validacao: teste de controller/use case para `CREDIT_CARD`.
- [x] P1.13.2 Manter o enum no schema se a coluna ja existe, documentando que valores extras sao legado/nao processados.
  - Problema: dropar enum quebra leitura de linhas antigas de teste.
  - Solucao: nao migrar o enum agora; so fechar a porta de escrita.
  - Validacao: DATA_MODEL/CURRENT_STATE dizem "escrita so PIX".

Done Criteria:

- [x] `POST /payments` com metodo nao-Pix falha.
- [x] Create sempre gera Pix ou nem cria.

## P2 - Acabamento e Higiene

### P2.1 Checkout: zerar `isFulfilling` no sucesso

Status: `concluido`

Problema: `handleFulfill` so volta `isFulfilling` para false no erro. No sucesso o spinner fica ate o poller ver estado terminal.

Impacto: o comprador ve loading preso depois de gerar o Pix.

Evidencia:

- `apps/checkout/src/components/checkout/CheckoutPage.tsx:71-85`

Subtasks:

- [x] P2.1.1 Zerar o flag no sucesso (e em `finally`, se o fluxo permitir).
  - Problema: estado de UI nao acompanha a resposta.
  - Solucao: `setIsFulfilling(false)` no caminho feliz; o poller continua dono do status.
  - Validacao: teste do componente ou checagem manual do checkout session.

Done Criteria:

- [x] Depois de fulfill 2xx, o botao/spinner nao fica travado.

### P2.2 Limpar comentarios que narram o codigo e a linguagem "P3"

Status: `concluido`

Problema: JSDoc de getter, `// 1. Validate store`, blocos "Use Case: X / Business rules" e o texto de Settings sobre "P3" / revisao comercial futura sao residuo de geracao.

Impacto: ruido para quem le o dominio; Settings promete fase que nao existe mais.

Evidencia:

- `packages/core/src/application/use-cases/create-payment.use-case.ts:77-90,123-253`
- `packages/core/src/application/services/fee-policy.service.ts:52-77`
- `apps/web/src/app/features/dashboard/pages/settings/settings.ts` (copy de P3 / revisao futura)
- getters em `payment.entity.ts`, `account.entity.ts`, `money.vo.ts`

Subtasks:

- [x] P2.2.1 Remover comentarios que so repetem o identificador ou numeram passos obvios nos arquivos do caminho financeiro.
  - Problema: o stencil cobre a regra de verdade.
  - Solucao: ficar so o "por que" (lazy expiration, titularidade, fallback de fila).
  - Validacao: review dos diffs sem novo JSDoc de getter.
- [x] P2.2.2 Reescrever o copy de Settings para o produto atual (read-only, sem "P3").
  - Problema: a tela fala de uma fase interna.
  - Solucao: texto alinhado a `docs/CURRENT_STATE.md`.
  - Validacao: `rg "P3" apps/web` vazio no settings.

Done Criteria:

- [x] Settings nao menciona P3.
- [x] Create/confirm payment nao tem lista numerada narrando o metodo.

### P2.3 Enxugar UoW e a composicao Nest

Status: `concluido`

Problema: `ITransactedRepositories` e um saco de 16 repos. Cada modulo Nest re-prove `'IUnitOfWork'`, JWT e CombinedAuth. Payment Link usa `'IUnitOfWorkPaymentLink'`. Factories com `any`.

Impacto: todo use case transacional força o bag a crescer; dois tokens de UoW sao footgun.

Evidencia:

- `packages/core/src/domain/repositories/unit-of-work.interface.ts:21-38`
- `apps/api/src/modules/payment-link/payment-link.module.ts:57-62`
- `apps/api/src/modules/idempotency/idempotency.module.ts`

Subtasks:

- [x] P2.3.1 Unificar o token de UoW na API (sumir `IUnitOfWorkPaymentLink`).
  - Problema: dois providers do mesmo seam.
  - Solucao: o global exportado pelo Idempotency/Infra module.
  - Validacao: um unico `provide: 'IUnitOfWork'` efetivo.
- [x] P2.3.2 Tipar as factories dos modules (sem `any` no composition root).
  - Problema: o compiler nao ve o construtor do use case.
  - Solucao: tipos dos ports ja exportados pelo core.
  - Validacao: `any` some dos `*.module.ts` da API.

Done Criteria:

- [x] Um token de UoW na API.
- [x] Composition root tipado.

### P2.4 Mover ApiKey para infrastructure e apagar pastas vazias

Status: `concluido`

Problema: quase todo repositorio foi para `packages/infrastructure`; `ApiKeyRepository` ficou em `apps/api/src/infra`. Worker ainda tem diretorios vazios `crypto/http/repositories/services`.

Impacto: o mapa mental do monorepo mente.

Evidencia:

- `apps/api/src/infra/repositories/api-key.repository.impl.ts`
- `apps/worker/src/infra/`

Subtasks:

- [x] P2.4.1 Mover o adapter de API key para `packages/infrastructure` e reexportar na API.
  - Problema: excecao sem motivo de runtime.
  - Solucao: o mesmo padrao de PaymentRepository.
  - Validacao: API nao implementa mais o repo; testes passam.
- [x] P2.4.2 Remover diretorios vazios do worker ou coloca-los no `.gitkeep` so se houver plano imediato.
  - Problema: pasta vazia parece seam.
  - Solucao: apagar.
  - Validacao: `apps/worker/src/infra` so tem o que e usado.

Done Criteria:

- [x] Adapters de persistencia de negocio nao moram na API.
- [x] Worker nao tem infra oca.

### P2.5 Dashboard: um helper de lista e tipos num lugar so

Status: `concluido`

Problema: Payment, Product, Payment Link, Customer e Receipt reimplementam `HttpParams` + signals de lista. `TransactionObject` esta declarado duas vezes. `PaymentService` ainda hospeda DTO de checkout, refund e webhook log.

Impacto: filtro/paginacao novo precisa de N patches. Tipos divergem em silencio.

Evidencia:

- `apps/web/src/app/core/services/payment.service.ts`
- `apps/web/src/app/core/services/product.service.ts`
- `apps/web/src/app/core/services/payment-link.service.ts`
- `apps/web/src/app/core/services/customer.service.ts`
- `apps/web/src/app/core/services/receipt.service.ts`
- `apps/web/src/app/core/services/financial.service.ts`

Subtasks:

- [x] P2.5.1 Extrair helper de query string + estado de lista (page/limit/total/error).
  - Problema: o padrao esta copiado.
  - Solucao: um modulo pequeno; services finos chamam o helper.
  - Validacao: pelo menos payments e payment-links usam o helper; specs de URL-backed filters continuam.
- [x] P2.5.2 Centralizar tipos de Payment/Transaction compartilhados.
  - Problema: duas `TransactionObject`.
  - Solucao: um arquivo de tipos do dashboard, importado pelos services.
  - Validacao: um unico `export interface TransactionObject`.

Done Criteria:

- [x] Lista operacional nova nao exige copiar o service inteiro.
- [x] Transaction nao tem duas definicoes.

### P2.6 Decidir o gate de web e checkout no CI

Status: `concluido`

Problema: CI nao roda testes do dashboard nem lint de web/checkout/demo. `turbo.json` sugere lint de monorepo; so API/worker tem `lint:check`.

Impacto: regressao de refund UI, filters e checkout spinner pode entrar em `main` sem gate.

Evidencia:

- `.github/workflows/ci.yml` (jobs `build` / `test`)
- `apps/web/package.json`
- `apps/checkout/package.json`

Subtasks:

- [x] P2.6.1 Ou adicionar `pnpm --filter @hockpay/web test` (e lint se existir) no CI, ou documentar em CURRENT_STATE que o gate e backend-only de proposito.
  - Problema: o meio termo atual e acidental.
  - Solucao: preferir um job `web-test` sem smoke visual; checkout fica no smoke scheduled.
  - Validacao: PR quebra um spec de `payment-detail` e o CI falha, ou o doc assume o risco.

Done Criteria:

- [x] A cobertura de CI e uma decisao escrita, nao um esquecimento.

### P2.7 Cidade do EMV Pix configuravel

Status: `concluido`

Problema: create payment e create Payment Link passam `merchantCity: "SAO PAULO"` fixo. O port do QR ja recebe a cidade.

Impacto: QR EMV mente a cidade do recebedor; study-cases fora de SP ficam errados no payload.

Evidencia:

- `packages/core/src/application/use-cases/create-payment.use-case.ts:259`
- `packages/core/src/application/use-cases/create-payment-link.use-case.ts:70`
- `packages/core/src/application/ports/pix-qr-code-generator.port.ts:44`

Subtasks:

- [x] P2.7.1 Usar cidade da store (ou config da store) com fallback documentado.
  - Problema: constante no use case.
  - Solucao: campo existente ou fallback `"SAO PAULO"` explicito no README de simulacao, nao escondido no meio do metodo.
  - Validacao: spec de create payment com store que tem cidade propria.

Done Criteria:

- [x] A cidade do EMV nao esta hardcoded nos dois use cases, ou o fallback esta documentado como limite do simulador.

## Public APIs / Interfaces Mentioned By This Goal

- `CombinedAuthGuard` deixa de autenticar JWT sem store e deixa de vazar verify; precedencia cookie vs API key vira contrato.
- List/get financeiros passam a honrar `environment` da request.
- `PaymentObject` deixa de ser o read model de tentativa; o JSON de lista de link pode permanecer, com tipo proprio.
- `POST /payments` deixa de aceitar metodo diferente de PIX.
- `Idempotency-Key` passa a ser exigida em create de Payment Link, checkout session e refund.
- Erros de checkout/Payment Link passam a ser `DomainError` com code no filter.
- Indice parcial `payments_one_paid_per_pix_charge_idx` precisa sobreviver a qualquer fluxo Prisma.

## Validation Log For This Goal

- [x] `pnpm --filter @hockpay/web test -- --watch=false` — 10 files, 26 tests passed (2026-08-18, unchanged this follow-up)
- [x] `pnpm run lint:check` — passou (API + worker)
- Smoke `p0,payment-link` via Docker nao executado neste ambiente (depende de Postgres/Redis e processos host). Cobertura equivalente: testes de core/infra/api/worker/web.

Re-run after the last webhook type fix (`FetchInit` / undici 7 vs `@types/node` `RequestInit`), 2026-08-18T23:42:27Z:

- [x] `pnpm --filter @hockpay/core test:ci` — 41 files, 180 tests passed
- [x] `pnpm --filter @hockpay/infrastructure test` — 14 files, 63 tests passed
- [x] `pnpm --filter @hockpay/api test` — 25 suites, 120 tests passed
- [x] `pnpm --filter @hockpay/worker test` — first failed 7/11 suites (`TS2322` on webhook `dispatcher`); after the type fix, 11 suites, 33 tests passed

Four skeptic items closed only after the re-run above:

- [x] Customer-history payment list/get honor request environment (`environment` required; TEST hides LIVE).
- [x] Checkout get/fulfill no longer remap `DomainError` to Nest 404/422.
- [x] Refund create no longer remaps `PaymentNotFoundError` / `InvalidRefundAmountError`.
- [x] Webhook `fetch` is pinned to the validated IP with original `Host` and SNI.

Comandos tipicos:

```bash
pnpm --filter @hockpay/core test
pnpm --filter @hockpay/infrastructure test
pnpm --filter @hockpay/api test
pnpm --filter @hockpay/worker test
pnpm --filter @hockpay/web test -- --watch=false
HOCKPAY_SMOKE_SUITE=p0,payment-link pnpm run smoke:docker
pnpm run lint:check
```

## Fora desta goal

- Processamento real de Pix, cartao, boleto, debito ou payout bancario.
- Settings mutavel / painel administrativo completo.
- Marketplace, split, multi-seller.
- Domain events in-process (outbox no use case continua o contrato certo).
- Reescrita "para DDD de verdade" das entidades anêmicas. Product ja mostra o padrao a seguir em feature nova; nao ha item para reescrever Merchant/Store/Transaction.

## Assumptions

- Caminho escolhido: `/GOAL.md` como unico tracker desta goal.
- Ordenacao: criticidade (P0 → P1 → P2); dentro da faixa, risco primeiro.
- Recorte: apertar o desenho atual, nao abrir produto novo.
- P0.2.2 (precedencia JWT vs API key) assume a regra recomendada: header `Authorization: Bearer hk_...` vence quando presente. Se a regra preferida for outra, registrar no item antes de implementar.
