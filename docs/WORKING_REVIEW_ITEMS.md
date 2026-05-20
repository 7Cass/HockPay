# Working Review Items

> Arquivo temporario de acompanhamento. Remover este arquivo quando todos os itens abaixo forem concluidos, validados e refletidos nas docs canonicas quando necessario.

Status geral: aberto.

Uso sugerido:

- manter cada item atualizado durante a execucao;
- marcar tarefas e criterios conforme forem concluidos;
- registrar desvios de solucao diretamente na secao afetada;
- apagar este arquivo ao final da leva.

## 1. Idempotencia atomica na API

Status: implementado em 2026-05-20. A barreira atomica agora e o PostgreSQL, dentro do mesmo `UnitOfWork` da mutacao financeira. Redis ficou apenas como cache de replay.

Notas da implementacao:

- `packages/infrastructure` usa `createMany(..., skipDuplicates: true)` para reservar a chave sem abortar a transacao em concorrencia por violacao de unique.
- `payments`, `withdrawals` e `refunds` executam reserva, mutacao e completion pelo `TransactionalIdempotencyService`.
- O interceptor ainda valida header, normaliza `Idempotency-Key`, serve replay via Redis/PostgreSQL e repassa TTL do decorator para o handler transacional.
- `lockedUntil` nao foi adicionado nesta leva; a serializacao fica pela unique key `(key, storeId)` e pelo wait do `INSERT ... ON CONFLICT DO NOTHING`/`createMany(skipDuplicates)` no PostgreSQL.
- Gap restante de hardening: teste e2e concorrente com PostgreSQL/Redis reais para provar o comportamento ponta a ponta fora de mocks/unitarios.

### Problema

A idempotencia atual e implementada como `check-then-act`: o `IdempotencyInterceptor` consulta Redis e PostgreSQL antes da execucao do handler, mas so grava a resposta idempotente depois que a mutacao ja aconteceu.

Referencias principais:

- `apps/api/src/common/interceptors/idempotency.interceptor.ts:107`: consulta Redis antes do handler.
- `apps/api/src/common/interceptors/idempotency.interceptor.ts:116`: consulta PostgreSQL antes do handler.
- `apps/api/src/common/interceptors/idempotency.interceptor.ts:265`: executa o handler.
- `apps/api/src/common/interceptors/idempotency.interceptor.ts:277`: grava Redis depois da mutacao.
- `apps/api/src/common/interceptors/idempotency.interceptor.ts:296`: grava PostgreSQL depois da mutacao.
- `apps/api/src/common/interceptors/idempotency.interceptor.ts:297`: falha ao salvar a chave e apenas logada.

Isso deixa uma janela de corrida: duas requisicoes simultaneas com o mesmo `Idempotency-Key`, mesmo `storeId` e mesmo body podem ambas nao encontrar chave em Redis/PostgreSQL e ambas executar a mutacao.

Os fluxos protegidos hoje usam `@Idempotent({ required: true })` em:

- `apps/api/src/modules/payment/payment.controller.ts:75`
- `apps/api/src/modules/withdrawal/withdrawal.controller.ts:43`
- `apps/api/src/modules/refund/refund.controller.ts:33`

Mas as mutacoes reais acontecem dentro de `UnitOfWork` separado da gravacao idempotente:

- `packages/core/src/application/use-cases/create-payment.use-case.ts:96`
- `packages/core/src/application/use-cases/create-withdrawal.use-case.ts:42`
- `packages/core/src/application/use-cases/create-refund.use-case.ts:30`

O banco tem `@@unique([key, storeId])` em `packages/database/prisma/schema.prisma:689`, mas essa restricao so e aplicada depois do efeito colateral, porque `IdempotencyKeyRepository.save()` faz `create` pos-handler em `packages/infrastructure/src/repositories/idempotency-key.repository.ts:40`.

### Impacto

- `POST /api/v1/payments` pode criar mais de um `Payment`, `PixCharge` e `OutboxEvent` para a mesma chave quando nao ha `externalId`.
- Com `externalId`, a segunda requisicao pode virar conflito/erro em vez de replay idempotente.
- `POST /api/v1/withdrawals` pode bloquear saldo duas vezes, criar dois saques, duas transacoes e dois eventos outbox.
- `POST /api/v1/refunds` pode deduzir saldo ou atualizar `totalRefunded` mais de uma vez.
- Redis pode conter resposta divergente do PostgreSQL.
- Se a gravacao da chave falhar depois da mutacao, retries futuros podem executar a operacao novamente.

### Solucao proposta

Mover a autoridade da idempotencia para o PostgreSQL, dentro da mesma transacao da mutacao de negocio. Redis deve ser apenas cache de replay, nunca a barreira de escrita.

A correcao recomendada e transformar a idempotencia em uma reserva transacional:

1. Dentro do mesmo `UnitOfWork` que cria pagamento, saque ou refund, inserir/reservar a chave idempotente antes dos efeitos colaterais.
2. Usar a restricao unica `(key, storeId)` para serializar concorrencia.
3. Persistir a resposta final da operacao na mesma transacao.
4. Se a mesma chave ja existir:
   - mesmo fingerprint/body/path: retornar a resposta persistida;
   - fingerprint/body/path diferente: retornar `409 IDEMPOTENCY_KEY_CONFLICT`;
   - chave expirada: tratar expiracao dentro do fluxo transacional.
5. So depois do commit popular Redis.

### Tarefas

- [x] Estender `ITransactedRepositories` para incluir `idempotencyKeyRepository`.
- [x] Alterar o modelo `IdempotencyKey` para suportar reserva/completion de forma clara, como `status`, `completedAt` e resposta nula enquanto pendente.
- [x] Criar metodos explicitos no repositorio: `reserve`, `complete`, `findCompleted`, `deleteExpiredForKey`.
- [x] Remover a dependencia do interceptor como mecanismo atomico para endpoints financeiros.
- [x] Manter o interceptor validando header e servindo cache/replay, sem permitir mutacoes sem reserva transacional.
- [x] Refatorar `CreatePaymentUseCase`, `CreateWithdrawalUseCase` e `CreateRefundUseCase` para execucao dentro de um wrapper transacional de idempotencia na API.
- [x] Nao engolir falha de persistencia idempotente nos fluxos criticos.
- [x] Validar `requestPath` e metodo no fingerprint, nao apenas hash do body.

### Criterios de corrigido

- [x] Duas requisicoes simultaneas identicas com o mesmo `Idempotency-Key` usam uma unica reserva transacional por `(key, storeId)`.
- [x] A segunda resposta retorna o mesmo recurso/DTO persistido e `x-idempotency-replayed: true` quando a chave ja esta completa.
- [x] Mesma chave com body/path/metodo diferente retorna `409 IDEMPOTENCY_KEY_CONFLICT` sem executar nova mutacao.
- [x] Redis desligado ou limpo nao quebra idempotencia; PostgreSQL continua sendo a fonte da verdade.
- [x] Falha no meio da transacao nao deixa recurso criado sem chave idempotente completada, porque a chave e completada no mesmo `UnitOfWork`.
- [x] Chaves expiradas continuam reutilizaveis com limpeza por chave/store antes da nova reserva.
- [ ] `payments`, `withdrawals` e `refunds` ainda precisam de cobertura e2e concorrente com PostgreSQL/Redis reais.

### Walkthrough de testes

1. [x] Rodar testes unitarios de core/infrastructure para reserva, replay, conflito e expiracao da chave.
2. [ ] Rodar teste concorrente de `POST /api/v1/payments` sem `externalId` com `Promise.all`, mesma chave e mesmo body; esperar um unico `Payment`, `PixCharge` e `OutboxEvent`.
3. [ ] Repetir `POST /api/v1/payments` com `externalId`; a segunda resposta deve replayar, nao retornar conflito de `externalId`.
4. [ ] Rodar teste concorrente de `POST /api/v1/withdrawals`; validar um unico saque, uma unica transacao e saldo bloqueado uma vez.
5. [ ] Rodar teste concorrente de `POST /api/v1/refunds`; validar um unico refund, `totalRefunded` incrementado uma vez e saldo deduzido uma vez.
6. [ ] Limpar Redis entre primeira e segunda chamada e confirmar replay via PostgreSQL.
7. [x] Enviar mesma chave com body/path diferente e confirmar `409` sem novas linhas de dominio em teste unitario do wrapper/repositorio.
8. [x] Rodar suites relevantes: `pnpm --filter @hockpay/core test:ci`, `pnpm --filter @hockpay/infrastructure test`, `pnpm --filter @hockpay/api test`, `pnpm --filter @hockpay/worker test` e `pnpm build`.

## 2. Modelo de estado Outbox/Webhook/BullMQ/DLQ

### Problema

O estado de entrega esta dividido entre quatro fontes sem um dono claro: `OutboxEvent`, `WebhookLog`, BullMQ e DLQ.

`OutboxEvent` tem estados `PENDING`, `DISPATCHED`, `PROCESSED`, `FAILED` em `packages/core/src/domain/entities/outbox-event.entity.ts:4`, mas falhas finais de entrega nao gravam estado terminal no banco. O `WebhookProcessor` move o job para `webhook-dead-letter` quando BullMQ esgota tentativas em `apps/worker/src/infra/queues/webhook.processor.ts:62`, porem nao atualiza o `OutboxEvent`.

O fan-out para multiplos webhooks e tratado como um unico job por `outboxEventId`. Se uma configuracao falha e outra entrega, o use case reenvia todas as configs em cada retry e so marca o outbox como `PROCESSED` quando todas sucedem. Referencias:

- `packages/core/src/application/use-cases/process-webhook.use-case.ts:129`
- `packages/core/src/application/use-cases/process-webhook.use-case.ts:139`

O script de DLQ tambem refileira jobs sem restaurar politica original de retry/backoff/jobId em `scripts/dlq.mjs:110`, diferente do fluxo normal em `apps/worker/src/infra/queues/webhook.queue.ts:34`.

### Impacto

- Webhooks ja entregues podem ser reenviados quando outra config do mesmo evento falha.
- Um evento pode aparecer como `DISPATCHED` no banco mesmo depois de estar em DLQ no Redis.
- `FAILED` no outbox hoje representa falha de enqueue no BullMQ, nao falha final de entrega HTTP.
- `WebhookLog.attempt` fica semanticamente confuso, pois cada tentativa cria novo log e `recordFailure` incrementa tentativa local.
- O watchdog de `DISPATCHED` pode reabrir eventos enquanto o job original segue no conjunto `failed` do BullMQ com mesmo `jobId`.
- Requeue manual via DLQ pode voltar com apenas uma tentativa efetiva.

### Solucao proposta

Definir o banco como fonte canonica do estado semantico e deixar BullMQ como motor de execucao/retry. O estado deve ser por entrega, nao apenas por evento.

Modelo recomendado:

- `OutboxEvent`: representa o evento de dominio e seu ciclo de despacho geral.
- `WebhookDelivery` ou `WebhookLog` com chave unica `(outboxEventId, configId)`: representa a entrega para uma config especifica.
- BullMQ job por entrega, idealmente `webhook-${outboxEventId}-${configId}`.
- DLQ registra falha final do job e atualiza a entrega correspondente para `FAILED_FINAL` ou equivalente.
- Requeue DLQ reseta a entrega para retry operacional e recria o job com as mesmas opcoes do fluxo normal.

Correcao minima aceitavel, se schema novo for grande demais: antes de enviar para cada config, consultar logs entregues por `(configId, outboxEventId)` e pular os ja entregues; em falha final no `onFailed`, marcar o outbox como `FAILED` ou gravar metadado terminal coerente; ajustar o script DLQ para usar as mesmas opcoes de `WebhookQueue.enqueue`.

### Tarefas

- [ ] Documentar o dono do estado: banco para negocio/operacional, BullMQ para tentativas tecnicas, DLQ para intervencao.
- [ ] Criar ou adaptar persistencia por entrega com unicidade por `configId + outboxEventId`.
- [ ] Persistir `status`, `attempt`, `maxAttempts`, `nextRetryAt`, `deliveredAt`, `failedAt`, `lastError`.
- [ ] Ajustar `ProcessWebhookUseCase` para nao reenviar configs ja entregues.
- [ ] Atualizar entrega existente em vez de criar logs duplicados sem vinculo de tentativa.
- [ ] Definir quando o outbox vira `PROCESSED` se algumas entregas estiverem terminalmente falhas.
- [ ] Ajustar `WebhookProcessor.onFailed` para atualizar estado canonico no banco ao mover para DLQ.
- [ ] Registrar `failedReason`, `attemptsMade`, `requestId`, `outboxEventId` e `configId`.
- [ ] Ajustar `scripts/dlq.mjs` para recriar jobs com `attempts`, `backoff`, `jobId` e `removeOn*` equivalentes ao fluxo normal.
- [ ] Evitar requeue cego quando o job original ainda existir em estado incompatibilidade.

### Criterios de corrigido

- [ ] Nao existem webhooks duplicados para configs ja entregues durante retry de outra config.
- [ ] Um job em `webhook-dead-letter` sempre tem estado correspondente no banco.
- [ ] `OutboxEvent.status` nao fica indefinidamente `DISPATCHED` apos falha final.
- [ ] Requeue de DLQ usa a mesma politica de retry/backoff do fluxo normal.
- [ ] Timeline/dashboard consegue explicar o estado: pendente, entregue, falha retryable ou falha final.
- [ ] `WebhookLog.attempt` reflete tentativa real, ou o modelo deixa claro que cada linha e uma tentativa individual.

### Walkthrough de testes

1. Rodar testes focados: `pnpm --filter @hockpay/core test:ci`, `pnpm --filter @hockpay/infrastructure test`, `pnpm --filter @hockpay/worker test`.
2. Validar fluxo feliz: criar webhook inbox, criar pagamento, confirmar pagamento TEST, verificar `OutboxEvent=PROCESSED`, entrega entregue e ausencia de DLQ.
3. Validar falha parcial: configurar dois webhooks, um 200 e outro 500; confirmar evento; verificar que o 200 recebe uma vez e retries tentam apenas o 500.
4. Validar DLQ: manter destino 500 ate esgotar BullMQ; verificar job em `webhook-dead-letter` e estado final no banco.
5. Validar requeue: corrigir destino para 200, rodar requeue DLQ, verificar nova entrega com politica normal e estado final processado.

## 3. Gaps transacionais em auth/store/checkout

### Problema

Ha fluxos criticos que executam multiplas escritas relacionadas sem uma fronteira transacional unica.

Em auth/store, `CreateStoreUseCase`, `SwitchStoreUseCase`, `LoginUseCase` e `RefreshTokenUseCase` combinam `save/update`, revogacao de refresh tokens e criacao de novo refresh token em chamadas separadas. Referencias:

- `packages/core/src/application/use-cases/create-store.use-case.ts:86`
- `packages/core/src/application/use-cases/switch-store.use-case.ts:77`
- `packages/core/src/application/use-cases/login.use-case.ts:89`
- `packages/core/src/application/use-cases/refresh-token.use-case.ts:83`
- `apps/api/src/infra/repositories/refresh-token.repository.impl.ts:71`

Em checkout, `FulfillCheckoutSessionUseCase` cria pagamento via `CreatePaymentUseCase`, que usa `UnitOfWork`, mas so depois marca a sessao como fulfilled em outro write fora da transacao:

- `packages/core/src/application/use-cases/fulfill-checkout-session.use-case.ts:63`
- `packages/core/src/application/use-cases/fulfill-checkout-session.use-case.ts:77`

O `UnitOfWork` atual nao oferece `merchantRepository`, `refreshTokenRepository` nem `checkoutSessionRepository`:

- `packages/core/src/domain/repositories/unit-of-work.interface.ts:16`
- `packages/infrastructure/src/repositories/unit-of-work.ts:30`

### Impacto

- Falhas intermediarias podem deixar loja criada sem `currentStoreId`.
- Merchant pode apontar para loja nova sem refresh token valido.
- Refresh tokens antigos podem ser apagados sem token novo persistido.
- Payment pode ser criado sem sessao marcada como `COMPLETED`.
- Dois refreshes/logins/switches concorrentes podem apagar ou sobrescrever o token retornado por outra requisicao.
- Dois fulfills concorrentes da mesma checkout session podem criar dois payments, com a sessao apontando so para o ultimo.

### Solucao proposta

Expandir a fronteira transacional para cobrir cada mudanca de estado inteira no banco.

Para auth/store, fazer a rotacao de refresh token e a atualizacao de merchant/store dentro de `UnitOfWork`. Para isso, mover/adaptar `MerchantRepository` e `RefreshTokenRepository` para `packages/infrastructure` com suporte a `PrismaClient | Prisma.TransactionClient`, expor esses repositorios no `ITransactedRepositories` e atualizar o wiring da API para injetar `IUnitOfWork` nos use cases mutantes.

Para checkout, tornar `FulfillCheckoutSessionUseCase` dono de uma transacao que inclua leitura/lock da sessao aberta, criacao de customer/pix/payment/outbox e atualizacao da sessao com `paymentId`. O nucleo de criacao de pagamento deve ser reutilizavel com repositorios transacionados, evitando `UnitOfWork` aninhado. Tambem deve haver lock/claim atomico por sessao `OPEN`.

### Tarefas

- [ ] Adicionar `merchantRepository`, `refreshTokenRepository` e `checkoutSessionRepository` ao contrato transacional.
- [ ] Migrar/adaptar `MerchantRepository` e `RefreshTokenRepository` para `packages/infrastructure`.
- [ ] Exportar novos repositorios por `@hockpay/infrastructure`.
- [ ] Refatorar `LoginUseCase`, `RefreshTokenUseCase`, `SwitchStoreUseCase` e `CreateStoreUseCase` para usar `unitOfWork.execute`.
- [ ] Manter `StoreRepository.save` dentro do UoW para que store e account participem da mesma transacao externa.
- [ ] Extrair logica interna de `CreatePaymentUseCase` para funcao/servico que aceite repositorios transacionados.
- [ ] Refatorar `FulfillCheckoutSessionUseCase` para abrir UoW, travar/claimar sessao `OPEN`, criar pagamento e salvar sessao fulfilled na mesma transacao.
- [ ] Atualizar `AuthModule`, `StoreModule` e `CheckoutSessionModule` para injetarem `IUnitOfWork`.
- [ ] Mapear conflitos esperados para erro limpo: token ja rotacionado, sessao ja completed/expired, slug unico violado.

### Criterios de corrigido

- [ ] Nenhum dos fluxos revisados faz multiplas escritas relacionadas fora de uma mesma transacao.
- [ ] Falha simulada entre revogar token e criar token novo nao apaga o refresh token anterior.
- [ ] Falha simulada apos criar store nao deixa merchant/token em estado parcial.
- [ ] Falha simulada apos criar payment em checkout nao deixa payment/pix/outbox persistidos sem sessao completed.
- [ ] Duplo fulfill concorrente da mesma sessao gera no maximo um payment.
- [ ] O wiring Nest dos fluxos mutantes usa `IUnitOfWork`, nao repositorios diretos, para operacao composta.

### Walkthrough de testes

1. Rodar unit tests novos no core com repositorios fake/fault-injection para `Login`, `RefreshToken`, `SwitchStore`, `CreateStore` e `FulfillCheckoutSession`.
2. Validar rollback: erro no ultimo write da transacao deve deixar estado anterior intacto.
3. Validar concorrencia: duas chamadas simultaneas de refresh/switch/fulfill devem resultar em um unico estado vencedor e erro/idempotencia clara para a outra.
4. Rodar `pnpm --filter @hockpay/core test:ci`.
5. Rodar `pnpm --filter @hockpay/api test`.
6. Em ambiente descartavel com infra local, rodar `pnpm run smoke:p0`.

## 4. Store creation, auth hydration, refresh waiters e withdrawals

### Problema

A criacao de loja nao completa a troca de contexto de autenticacao. O use case gera novo access token com `storeId` e revoga refresh tokens antigos em `packages/core/src/application/use-cases/create-store.use-case.ts:89`, mas o controller grava apenas `hockpay_rt`, nao grava o novo `hockpay_at`:

- `apps/api/src/modules/store/store.controller.ts:75`
- `apps/api/src/modules/store/store.controller.ts:87`

No web, `createStore()` so troca `currentStore` em memoria:

- `apps/web/src/app/core/services/store.service.ts:105`
- `apps/web/src/app/shared/components/create-store-dialog/create-store-dialog.component.ts:82`

A hidratacao de auth tambem e incompleta. Apos login, `AuthService` marca `isAuthenticated=true` e popula `currentUser` com documento vazio e sem `currentStoreId`:

- `apps/web/src/app/core/services/auth.service.ts:65`
- `apps/web/src/app/core/services/auth.service.ts:81`
- `apps/web/src/app/core/services/auth.service.ts:134`

Isso afeta selecao de loja e criacao de conta Pix em withdrawals:

- `apps/web/src/app/core/services/store.service.ts:70`
- `apps/web/src/app/features/dashboard/pages/withdrawals/withdrawals.ts:384`

O refresh coordenado por `refreshSubject` deixa waiters pendurados quando o refresh falha, porque chamadas concorrentes ficam em `filter(done => done)` e a falha publica `false`:

- `apps/web/src/app/core/services/auth.service.ts:101`
- `apps/web/src/app/core/services/auth.service.ts:125`

Em withdrawals, `WithdrawalController.getStoreId()` lanca `Error` cru quando nao ha store no JWT/request:

- `apps/api/src/modules/withdrawal/withdrawal.controller.ts:106`
- `apps/api/src/modules/withdrawal/withdrawal.controller.ts:110`

Os botoes TEST de completar/falhar ficam travados se o usuario cancela `confirm()`, porque `actionLoading` e setado antes do confirm e nao e limpo no retorno:

- `apps/web/src/app/features/dashboard/pages/withdrawal-detail/withdrawal-detail.ts:116`
- `apps/web/src/app/features/dashboard/pages/withdrawal-detail/withdrawal-detail.ts:137`

### Impacto

- Usuario que cria primeira loja ou nova loja pode continuar com access cookie antigo sem `storeId` correto.
- Endpoints store-scoped podem retornar 403/500, operar na loja anterior ou mostrar estado stale ate access token expirar.
- Apos login, withdrawals pode nao conseguir criar conta Pix verificada porque `currentUser.document` fica vazio.
- A selecao inicial de loja pode cair no primeiro item em vez da `currentStoreId` real.
- Quando varios requests recebem 401 ao mesmo tempo e refresh falha, parte da UI pode ficar carregando indefinidamente.

### Solucao proposta

1. Fazer `POST /stores` ter a mesma semantica de sessao de `login` e `switch-store`: gravar tambem o cookie `hockpay_at` com `result.accessToken`.
2. No web, tratar criacao de loja como troca de tenant: atualizar stores/currentStore, hidratar `currentUser.currentStoreId` ou chamar hidratacao forcada, e limpar estado store-scoped.
3. Corrigir hidratacao de auth usando perfil completo retornado no login ou chamando `/merchants/me` apos login.
4. Trocar refresh waiter por observable compartilhado de refresh em andamento, com propagacao de erro para todos os waiters.
5. Em withdrawals API, usar `@CurrentStore()` no controller ou lancar erro estruturado quando nao houver store.
6. Em `WithdrawalDetail.complete()` e `fail()`, limpar `actionLoading` quando usuario cancela `confirm()`.

### Tarefas

- [ ] API: adicionar cookie `hockpay_at` em `StoreController.createStore`.
- [ ] Web auth: criar hidratacao forcada em `AuthService` e usa-la apos login e criacao de loja.
- [ ] Web auth: evitar `currentUser` parcial em fluxo autenticado.
- [ ] Web store: alinhar `createStore()` com `switchStore()`, incluindo atualizacao de estado e limpeza/reload de telas store-scoped.
- [ ] Web refresh: substituir `BehaviorSubject<boolean>` por refresh in-flight compartilhado que emite erro para todos os inscritos.
- [ ] API withdrawals: substituir `getStoreId(req)` por `@CurrentStore() storeId: string` em `create/list/get`, ou mapear ausencia de store para 403 estruturado.
- [ ] Web withdrawals: corrigir retorno de cancelamento dos confirms TEST.
- [ ] Adicionar cobertura para cookies de criacao de loja, hidratacao pos-login, falha concorrente de refresh e cancelamento dos botoes TEST.

### Criterios de corrigido

- [ ] Criar loja retorna `Set-Cookie` para `hockpay_at` e `hockpay_rt`.
- [ ] Depois de criar loja, chamadas imediatas a `/accounts/me`, `/bank-accounts` e `/withdrawals` usam a nova loja sem esperar expiracao do access token.
- [ ] Depois de login, `currentUser.document`, `formattedDocument`, `documentType` e `currentStoreId` estao preenchidos antes de abrir withdrawals.
- [ ] Falha de refresh simultanea nao deixa requests pendurados; todos recebem erro e auth vai para `false`.
- [ ] Withdrawal sem store selecionada retorna 403 estruturado, nao 500.
- [ ] Cancelar "Completar" ou "Falhar" em detalhe de saque reabilita os botoes.

### Walkthrough de testes

1. Rodar testes direcionados de API/core/web adicionados para os pontos acima.
2. Rodar `pnpm --filter @hockpay/api test` e `pnpm --filter @hockpay/core test:ci`.
3. Rodar build/test web aplicavel: `pnpm --filter @hockpay/web build` e, se houver specs novas, `pnpm --filter @hockpay/web test`.
4. Smoke manual: login com merchant sem loja, criar loja, verificar cookies no browser e abrir dashboard sem erro.
5. Smoke manual withdrawals: criar conta Pix verificada, solicitar saque, abrir detalhe, cancelar "Completar" e "Falhar" confirmando que botoes nao travam.
6. Smoke concorrencia: expirar/remover refresh token e disparar multiplas chamadas protegidas; confirmar que todas falham/redirectam sem spinner infinito.

## 5. PrismaService, migrations, claims e invariantes de banco

### Problema

O repo tem duplicacao e fragilidade no acesso ao banco:

1. `PrismaService` esta duplicado entre API e worker:
   - `apps/api/src/infra/database/prisma.service.ts:11`
   - `apps/worker/src/infra/database/prisma.service.ts:11`
2. A API registra `PrismaService` diretamente em varios modulos, apesar de ja existir `PrismaModule` global:
   - `apps/api/src/infra/database/prisma.module.ts:13`
   - `apps/api/src/app.module.ts:84`
   - exemplos: `payment.module.ts:67`, `webhook.module.ts:53`, `withdrawal.module.ts:30`, `auth.module.ts:40`, `store.module.ts:25`, `customer.module.ts:31`, `bank-account.module.ts:24`, `transaction.module.ts:24`.
3. O build do pacote database compila `src` e copia apenas o client gerado em `packages/database/package.json:9`; schema e migrations ficam fora de `dist`.
4. Claims do worker nao sao atomicos:
   - `packages/infrastructure/src/repositories/outbox.repository.ts:88`
   - `apps/worker/src/jobs/outbox-dispatcher.job.ts:76`
   - `packages/infrastructure/src/repositories/withdrawal.repository.ts:125`
   - `packages/core/src/application/use-cases/mark-withdrawal-processing.use-case.ts:27`

### Impacto

- A API pode abrir multiplos pools Prisma no mesmo processo, multiplicando conexoes, listeners de query e lifecycle.
- Build/deploy baseado so em `dist` nao tem migrations para `prisma migrate deploy`.
- Dois workers, lock expirado ou reprocessamento podem selecionar os mesmos outbox events/withdrawals.
- `WithdrawalProcessingJob` ignora `alreadyProcessing` depois de `markProcessingUseCase.execute` e segue para payout/complete.
- Atualizacoes financeiras fazem read-modify-write sem lock explicito; `AccountRepository.update` sobrescreve saldos absolutos.

### Solucao proposta

- Manter um unico provider Prisma por app: remover `PrismaService` dos `providers` dos modulos de negocio e injetar somente o provider exportado pelo `PrismaModule` global.
- Centralizar ou compartilhar implementacao Nest do PrismaService/PrismaModule entre API e worker para evitar drift.
- Ajustar build do `@hockpay/database` para publicar/copiar `prisma/schema.prisma`, `prisma/migrations` e `prisma.config.ts`, ou documentar explicitamente que migrations rodam do workspace-fonte.
- Substituir claims por operacoes atomicas no Postgres:
  - outbox: `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED LIMIT n) RETURNING *`;
  - withdrawals: claim unico que move `PENDING`/stale `PROCESSING` para `PROCESSING`, incrementa tentativas e retorna somente linhas claimadas.
- Para saldos, usar lock de linha (`SELECT ... FOR UPDATE`) ou updates condicionais/incrementais no banco; se usar `Serializable`, adicionar retry em conflito.

### Tarefas

- [ ] Remover `PrismaService` dos modulos da API que redeclaram provider.
- [ ] Criar teste de bootstrap Nest garantindo uma unica instancia de `PrismaService`.
- [ ] Consolidar implementacao duplicada de API/worker.
- [ ] Atualizar `packages/database/package.json` para incluir artefatos Prisma no build.
- [ ] Implementar `claimDispatchableEvents(limit)` no `OutboxRepository`.
- [ ] Implementar `claimProcessableWithdrawals(limit)` no `WithdrawalRepository`.
- [ ] Fazer `WithdrawalProcessingJob` processar apenas withdrawals efetivamente claimadas.
- [ ] Proteger mutations de saldo com lock/update atomico.
- [ ] Adicionar testes de concorrencia para outbox, withdrawals e saldo.

### Criterios de corrigido

- [ ] So `PrismaModule` registra `PrismaService` por app.
- [ ] `pnpm --filter @hockpay/database build` gera `dist` com client, schema e migrations.
- [ ] Dois workers concorrentes nao claimam o mesmo outbox event ou withdrawal.
- [ ] `alreadyProcessing` nao dispara payout.
- [ ] Saldos nao tem lost update em confirmacoes, releases, refunds e withdrawals concorrentes.
- [ ] `pnpm db:deploy` funciona a partir do artefato esperado de deploy.

### Walkthrough de testes

1. Rodar `pnpm db:generate`.
2. Rodar `pnpm --filter @hockpay/database build` e verificar `dist/prisma/schema.prisma` e `dist/prisma/migrations`.
3. Rodar testes unitarios de API, worker e infrastructure.
4. Adicionar teste concorrente de outbox com dois claimers e assert de ids distintos.
5. Adicionar teste concorrente de withdrawals com dois claimers e assert de uma unica transicao para `PROCESSING`.
6. Adicionar teste de saldo com duas confirmacoes/saques simultaneos e assert de saldo final/ledger.
7. Rodar smoke de withdrawals e P0 apos subir Postgres/Redis e aplicar migrations.

## 6. Docs, env e contratos apos redesign da landing

### Problema

A documentacao e os exemplos visiveis ficaram parcialmente desalinhados do runtime atual.

`docs/CURRENT_STATE.md` se declara fonte canonica do runtime em `docs/CURRENT_STATE.md:3`, e `docs/TARGET_ARCHITECTURE.md` pede exemplos alinhados a `/api/v1` em `docs/TARGET_ARCHITECTURE.md:17`. Mesmo assim, a landing exibe pseudo-SDK/contrato que nao existe no repo:

- `hockpay.payments.create`
- `method`
- `scenario`
- `POST /payments`
- status `PAID`
- eventos `webhook.sent` e `retry.safe`

Referencias:

- `apps/web/src/app/features/landing/pages/home/home.html:102`
- `apps/web/src/app/features/landing/pages/home/home.html:105`
- `apps/web/src/app/features/landing/pages/home/home.html:157`

O contrato real de criacao usa REST em `/api/v1/payments`, `Idempotency-Key`, `customer.document` e `paymentMethod`, sem `scenario`:

- `apps/api/README.md:58`
- `apps/api/src/modules/payment/dtos/create-payment.dto.ts:88`
- `apps/api/src/modules/payment/dtos/create-payment.dto.ts:112`

Tambem ha ambiguidade entre dois contratos de simulacao:

- fluxo autenticado TEST: `/api/v1/dev/simulate/:id/:action`;
- checkout dev UI: `/api/v1/payments/:id/simulate/:action` com `checkoutToken`.

A matriz de env tambem precisa ser normalizada. A API usa `REDIS_HOST`/`REDIS_PORT` para BullMQ/throttling, mas `REDIS_URL` para idempotencia. `CHECKOUT_BASE_URL`, `PUBLIC_API_BASE_URL` e `APP_URL` afetam URLs publicas, mas nao aparecem claramente na tabela de env da API.

### Impacto

- Integradores e proximos agentes podem copiar exemplos que nao rodam.
- Pode haver escolha errada do endpoint de simulacao.
- Redis pode ser configurado parcialmente, deixando API/worker em filas diferentes.
- A landing passa impressao de SDK publico e eventos inexistentes.
- Eventos validos devem vir de `ALLOWED_WEBHOOK_EVENTS` em `packages/core/src/domain/constants/webhook-events.ts:4`.

### Solucao proposta

Criar uma fonte unica de contratos locais nos docs/runbook e alinhar READMEs e landing a ela.

A landing pode continuar com copy de marketing, mas exemplos devem ser reais ou explicitamente rotulados como pseudocodigo, sem nomes de campos/eventos que parecam contrato publico.

### Tarefas

- [ ] Atualizar exemplo da landing para REST real com `/api/v1/payments`, `Idempotency-Key`, `customer.document` e `paymentMethod: "PIX"`, ou marcar claramente como pseudocodigo nao copiavel.
- [ ] Trocar/remover `scenario`, `webhook.sent` e `retry.safe`.
- [ ] Usar eventos permitidos como `payment.created`, `payment.confirmed`, `payment.failed`, `payment.expired`.
- [ ] Separar nos docs os dois contratos de simulacao: integracao autenticada TEST (`/dev/simulate`) e checkout dev UI (`/payments/:id/simulate/:action` + `checkoutToken`).
- [ ] Adicionar matriz de env por app: root compartilhado, API, worker, checkout, demo e smoke.
- [ ] Incluir `REDIS_URL`, `REDIS_HOST`, `REDIS_PORT`, `CHECKOUT_BASE_URL`, `PUBLIC_API_BASE_URL`, `APP_URL`, `NEXT_PUBLIC_API_URL`, `HOCKPAY_BASE_URL` e cron envs do worker.
- [ ] Revisar `apps/api/README.md`, `apps/worker/README.md`, `apps/checkout/README.md`, `apps/demo-mediakit/README.md` e `docs/RUNBOOK.md`.
- [ ] Nao documentar valores reais de `.env`; usar placeholders e, se necessario, criar/atualizar `.env.example` sem segredos.

### Criterios de corrigido

- [ ] Nenhum exemplo copiavel usa endpoint sem `/api/v1`, salvo rotas do frontend como `/pay/:token` ou checkout `/:token`.
- [ ] `rg` nao encontra `scenario: 'paid'`, `webhook.sent` ou `retry.safe` em exemplos tratados como contrato.
- [ ] Todo exemplo de `POST /api/v1/payments` inclui `Idempotency-Key` e `customer.document`.
- [ ] READMEs distinguem claramente `/api/v1/dev/simulate/:id/:action` de `/api/v1/payments/:id/simulate/:action`.
- [ ] Matriz de env cobre todas as variaveis realmente lidas pelo runtime e explica o split `REDIS_URL` vs `REDIS_HOST`/`REDIS_PORT`.
- [ ] Landing, docs e demo usam apenas eventos presentes em `ALLOWED_WEBHOOK_EVENTS`.

### Walkthrough de testes

1. Rodar varredura textual:

   ```bash
   rg -n "scenario:|webhook.sent|retry.safe|POST /payments|/payments/:id/simulate|/dev/simulate|REDIS_URL|CHECKOUT_BASE_URL|PUBLIC_API_BASE_URL" README.md docs apps/*/README.md apps/web/src/app/features/landing/pages/home/home.html
   ```

2. Conferir matriz de env contra o codigo:

   ```bash
   rg -n "process.env|ConfigService|get<string>|NEXT_PUBLIC_|HOCKPAY_" apps/api/src apps/worker/src apps/checkout/src apps/demo-mediakit
   ```

3. Validar builds/testes focados:

   ```bash
   pnpm --filter @hockpay/web build
   pnpm --filter @hockpay/checkout build
   pnpm --filter @hockpay/api test
   pnpm --filter @hockpay/worker test
   ```

4. Validar fluxo integrado:

   ```bash
   pnpm run smoke:docker
   ```

5. Fazer checagem manual final na landing: exemplo visivel deve bater com os READMEs e nao parecer SDK/contrato inexistente.
