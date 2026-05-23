# Working Review Items

> Arquivo temporario de acompanhamento. Remover este arquivo quando todos os itens abaixo forem concluidos, validados e refletidos nas docs canonicas quando necessario.

Status geral: reaberto em 2026-05-22 apos auditoria paralela. Follow-ups dos itens 1, 2, 4 e 5 foram implementados; 2/6 itens macro ainda tem follow-ups de auditoria abertos.

Progresso macro:

- [x] 1. Idempotencia atomica na API
- [x] 2. Modelo de estado Outbox/Webhook/BullMQ/DLQ
- [ ] 3. Gaps transacionais em auth/store/checkout
- [x] 4. Store creation, auth hydration, refresh waiters e withdrawals
- [x] 5. PrismaService, migrations, claims e invariantes de banco
- [ ] 6. Docs, env e contratos apos redesign da landing

Uso sugerido:

- manter cada item atualizado durante a execucao;
- marcar tarefas e criterios conforme forem concluidos;
- registrar desvios de solucao diretamente na secao afetada;
- apagar este arquivo ao final da leva.

## 1. Idempotencia atomica na API

Status: concluido em 2026-05-20. A barreira atomica agora e o PostgreSQL, dentro do mesmo `UnitOfWork` da mutacao financeira. Redis ficou apenas como cache de replay. O smoke concorrente real da suite opt-in `idempotency`, as suites focadas e o build final passaram.

Auditoria 2026-05-22: follow-ups de validacao concluidos. O contrato foi refinado para cache de idempotencia indisponivel, com cobertura dedicada de `IdempotencyCacheService`, `IdempotencyInterceptor` e smoke opt-in `idempotency-redis-unavailable`.

Notas da implementacao:

- `packages/infrastructure` usa `createMany(..., skipDuplicates: true)` para reservar a chave sem abortar a transacao em concorrencia por violacao de unique.
- `payments`, `withdrawals` e `refunds` executam reserva, mutacao e completion pelo `TransactionalIdempotencyService`.
- O interceptor ainda valida header, normaliza `Idempotency-Key`, serve replay via Redis/PostgreSQL e repassa TTL do decorator para o handler transacional.
- `lockedUntil` nao foi adicionado nesta leva; a serializacao fica pela unique key `(key, storeId)` e pelo wait do `INSERT ... ON CONFLICT DO NOTHING`/`createMany(skipDuplicates)` no PostgreSQL.
- O smoke concorrente real fica fora das suites default de `smoke:docker`; para exercitar este item explicitamente, usar `HOCKPAY_SMOKE_SUITE=idempotency pnpm run smoke:docker`.

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

- [x] 1.1 Modelagem e contrato transacional
  - Problema: a chave idempotente era persistida depois da mutacao financeira e fora do `UnitOfWork`.
  - Solucao: incluir `idempotencyKeyRepository` em `ITransactedRepositories`, adicionar `status`, `completedAt` e resposta nula para reserva pendente.
  - Validacao: migration `20260520000100_atomic_idempotency`, contrato de UoW e testes de core/infrastructure.

- [x] 1.2 Repositorio de reserva/completion
  - Problema: o repositorio so tinha gravacao final por `create`, entao concorrencia dependia de check-then-act.
  - Solucao: implementar `reserve`, `complete`, `findCompleted` e `deleteExpiredForKey` usando unique `(key, storeId)`; reservas pendentes usam `createMany(..., skipDuplicates: true)` e nao enviam campos opcionais como `undefined`.
  - Validacao: `packages/infrastructure/src/repositories/idempotency-key.repository.spec.ts` cobre reserva, replay, conflito, expiracao e completion.

- [x] 1.3 Wrapper transacional nos endpoints financeiros
  - Problema: `payments`, `withdrawals` e `refunds` podiam executar mutacao antes da chave idempotente existir.
  - Solucao: executar reserva, mutacao e completion dentro do `TransactionalIdempotencyService`, no mesmo `UnitOfWork` dos use cases financeiros.
  - Validacao: specs dos controllers e do `TransactionalIdempotencyService` cobrem chamada pelo wrapper, replay e conflito.

- [x] 1.4 Interceptor como cache/replay, nao barreira atomica
  - Problema: o interceptor misturava responsabilidade de validacao/cache com autoridade de escrita.
  - Solucao: manter header obrigatorio, contexto de request, replay via Redis/PostgreSQL e conflitos por fingerprint; a barreira de escrita fica no wrapper transacional.
  - Validacao: replay por PostgreSQL apos limpeza de Redis no smoke e retorno `x-idempotency-replayed: true`.

- [x] 1.5 Fingerprint canonico entre body bruto e DTO
  - Problema: o interceptor calcula fingerprint antes dos pipes e o wrapper calcula depois, entao `JSON.stringify` direto podia gerar hash diferente por ordem de chaves.
  - Solucao: normalizar o corpo com ordenacao recursiva de chaves e omitir `undefined` antes de gerar o hash.
  - Validacao: `apps/api/src/common/idempotency/idempotency-fingerprint.spec.ts` cobre ordem de chaves e corpo raw/DTO-shaped.

- [x] 1.6 Smoke concorrente real opt-in
  - Problema: os testes anteriores eram mockados e nao provavam o comportamento com PostgreSQL/Redis reais.
  - Solucao: adicionar `scripts/smoke-idempotency-concurrency.mjs` e o script `smoke:idempotency`, registrado como suite opt-in no orquestrador.
  - Validacao: `HOCKPAY_SMOKE_SUITE=idempotency pnpm run smoke:docker` cobre pagamentos com/sem `externalId`, replay por PostgreSQL, conflitos, withdrawals e refunds concorrentes.

- [x] 1.7 Hardening do smoke/orquestrador
  - Problema: o smoke podia gerar falso positivo por comparar apenas IDs e o orquestrador nao detectava processos em IPv6 na porta 3000.
  - Solucao: comparar DTOs completos, validar ausencia de mutacao em conflito de path, pular worker/checkout quando a suite for apenas `idempotency` e checar portas em IPv4/IPv6.
  - Validacao: `node --check` nos scripts e smoke docker opt-in passando sem usar API orfa.

- [x] 1.8 Rodada final ampla
  - Problema: o item so deve fechar depois das suites relevantes e build passarem no estado final.
  - Solucao: rodar core, infrastructure, api, worker e build.
  - Validacao: `pnpm --filter @hockpay/core test:ci`, `pnpm --filter @hockpay/infrastructure test`, `pnpm --filter @hockpay/api test`, `pnpm --filter @hockpay/worker test` e `pnpm build`.

### Criterios de corrigido

- [x] Duas requisicoes simultaneas identicas com o mesmo `Idempotency-Key` usam uma unica reserva transacional por `(key, storeId)`.
- [x] A segunda resposta retorna o mesmo recurso/DTO persistido e `x-idempotency-replayed: true` quando a chave ja esta completa.
- [x] Mesma chave com body/path/metodo diferente retorna `409 IDEMPOTENCY_KEY_CONFLICT` sem executar nova mutacao.
- [x] Redis limpo ou cache de idempotencia indisponivel nao quebra replay/nao duplicacao da idempotencia; PostgreSQL continua sendo a fonte da verdade. A plataforma operacional completa ainda depende de Redis para filas, throttling e outros componentes.
- [x] Falha no meio da transacao nao deixa recurso criado sem chave idempotente completada, porque a chave e completada no mesmo `UnitOfWork`.
- [x] Chaves expiradas continuam reutilizaveis com limpeza por chave/store antes da nova reserva.
- [x] `payments`, `withdrawals` e `refunds` tem cobertura concorrente com PostgreSQL/Redis reais pela suite opt-in `idempotency`.

### Walkthrough de testes

1. [x] Rodar testes unitarios de core/infrastructure para reserva, replay, conflito e expiracao da chave.
2. [x] Rodar teste concorrente de `POST /api/v1/payments` sem `externalId` com `Promise.all`, mesma chave e mesmo body; esperar um unico `Payment`, `PixCharge` e `OutboxEvent`.
3. [x] Repetir `POST /api/v1/payments` com `externalId`; a segunda resposta deve replayar, nao retornar conflito de `externalId`.
4. [x] Rodar teste concorrente de `POST /api/v1/withdrawals`; validar um unico saque, uma unica transacao e saldo bloqueado uma vez.
5. [x] Rodar teste concorrente de `POST /api/v1/refunds`; validar um unico refund, `totalRefunded` incrementado uma vez e saldo deduzido uma vez.
6. [x] Limpar Redis entre primeira e segunda chamada e confirmar replay via PostgreSQL.
7. [x] Enviar mesma chave com body/path diferente e confirmar `409` sem novas linhas de dominio em teste unitario do wrapper/repositorio.
8. [x] Rodar suites relevantes no estado final: `pnpm --filter @hockpay/core test:ci`, `pnpm --filter @hockpay/infrastructure test`, `pnpm --filter @hockpay/api test`, `pnpm --filter @hockpay/worker test` e `pnpm build`.

### Tarefas reabertas pela auditoria 2026-05-22

- [x] 1.9.1 Refinar criterio de Redis indisponivel
  - Problema: o criterio atual mistura cache de idempotencia com Redis operacional da API/worker, incluindo throttling e filas.
  - Solucao: limitar o contrato a replay/nao duplicacao via PostgreSQL quando o cache Redis de idempotencia falha, mantendo claro que a plataforma completa ainda depende de Redis.
  - Validacao: este documento distingue Redis limpo, Redis cache indisponivel e Redis operacional da plataforma.

- [x] 1.9.2 Cobrir degradacao do cache de idempotencia
  - Problema: `IdempotencyCacheService` deve degradar em `get/set` com erro, mas isso ainda nao tem spec dedicada.
  - Solucao: adicionar spec com Redis mockado falhando em `get`, `setex` e lifecycle quando aplicavel.
  - Validacao: `pnpm --filter @hockpay/api test -- idempotency-cache.service.spec.ts` passa e prova que erro de cache nao propaga para o fluxo.

- [x] 1.9.3 Provar fallback para PostgreSQL quando o cache falha
  - Problema: o interceptor consulta cache antes de PostgreSQL; a validacao deve garantir que cache miss/falha nao impede replay pelo banco.
  - Solucao: cobrir no spec do `IdempotencyInterceptor` que cache sem resposta leva a `repository.findCompleted()` e replaya o registro persistido.
  - Validacao: spec focada falha se o interceptor deixar de consultar PostgreSQL quando o cache nao retorna resposta.

- [x] 1.9.4 Criar smoke opt-in para Redis indisponivel
  - Problema: o smoke atual apaga a chave no Redis, mas nao simula conexao indisponivel.
  - Solucao: adicionar suite opt-in `idempotency-redis-unavailable` que cria payment com Redis ativo, para Redis, repete a mesma request e reinicia Redis em `finally`.
  - Validacao: replay retorna `x-idempotency-replayed: true`, mesmo DTO e sem duplicar `Payment`, `PixCharge`, `OutboxEvent` ou chave idempotente.

- [x] 1.10.1 Criar harness unitario do `IdempotencyInterceptor`
  - Problema: nao ha spec direta para o interceptor, e seus branches dependem de `ExecutionContext`, response e `CallHandler`.
  - Solucao: criar helpers de teste para contexto, response, next handler, cache e repository fakes.
  - Validacao: spec consegue resolver/rejeitar o observable com `firstValueFrom` sem subir Nest real.

- [x] 1.10.2 Cobrir bypass, header obrigatorio e store ausente
  - Problema: header ausente e store ausente sao contratos publicos de erro.
  - Solucao: testar endpoint sem decorator, decorator sem header, `required=true` sem header/blank header e header com `request.store` ausente.
  - Validacao: respostas esperadas incluem `IDEMPOTENCY_KEY_REQUIRED` e `IDEMPOTENCY_STORE_REQUIRED`, e bypass nao consulta cache/repository.

- [x] 1.10.3 Cobrir normalizacao de header e contexto TTL
  - Problema: chave pode vir com espacos ou array, e o wrapper transacional depende do contexto no request.
  - Solucao: testar trim, primeiro valor de array e `ttlSeconds` em `getIdempotencyRequestContext`.
  - Validacao: handler recebe contexto com chave normalizada e TTL correto.

- [x] 1.10.4 Cobrir replay e conflito por Redis
  - Problema: cache hit deve responder sem handler/repository e conflito deve retornar `IDEMPOTENCY_KEY_CONFLICT`.
  - Solucao: testar cache hit com fingerprint igual e divergente.
  - Validacao: headers `x-idempotency-replayed`/`x-idempotency-key`, status persistido e ausencia de chamada ao handler/repository.

- [x] 1.10.5 Cobrir replay e conflito por PostgreSQL
  - Problema: replay via banco e recache em Redis sao parte do contrato quando Redis nao tem resposta.
  - Solucao: testar `findCompleted` com fingerprint igual, divergente e nulo.
  - Validacao: replay usa resposta/status persistidos, chama `cacheService.set` no caso feliz e retorna conflito sem handler no caso divergente.

- [x] 1.10.6 Cobrir modo sem repository
  - Problema: o interceptor aceita repository opcional e precisa manter cache-only/bypass seguro.
  - Solucao: instanciar com `repository=null` e validar cache miss seguindo para handler.
  - Validacao: spec cobre branch sem repository.

## 2. Modelo de estado Outbox/Webhook/BullMQ/DLQ

Status: concluido em 2026-05-20. Nesta leva, `WebhookLog` foi adaptado como linha canonica de entrega por `configId + outboxEventId`, sem introduzir uma tabela nova nem trocar endpoints publicos. BullMQ continua como motor tecnico de retries por outbox, e a DLQ agora preserva opcoes de requeue e aponta para o estado canonico no banco.

Auditoria 2026-05-22: follow-ups concluidos. O requeue de DLQ agora reseta estado canonico antes de reenfileirar, a UI usa status de entrega canonico, retry manual valida `configId` da rota e o script de DLQ tem helpers cobertos por `node --test`.

Notas da implementacao:

- `WebhookLog` ganhou `status`, `failedAt`, `lastError` e unique por `(configId, outboxEventId)`.
- A migration `20260520000200_webhook_delivery_state` deduplica entregas antigas por par config/outbox, preferindo linhas ja entregues.
- `ProcessWebhookUseCase` reutiliza a entrega existente, pula configs ja `DELIVERED` e atualiza a mesma linha em novas tentativas.
- `WebhookProcessor.onFailed` marca entregas nao entregues como `FAILED_FINAL`, torna o `OutboxEvent` uma falha terminal e so entao cria o job na DLQ.
- `scripts/dlq.mjs` requeuea com `jobId`, `attempts`, `backoff`, `removeOnComplete` e `removeOnFail`, bloqueando job alvo existente sem `--force`.
- Requeue manual de webhook reseta apenas entregas nao `DELIVERED`, respeita `configIds` quando presentes e marca o outbox como `DISPATCHED` com watchdog futuro para evitar duplicidade imediata pelo dispatcher.
- Como o job ainda e por outbox, a DLQ registra `configIds` afetados quando eles existem; job por entrega fica fora desta leva.

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

- [x] 2.1 Definir dono do estado e escopo desta leva
  - Problema: `OutboxEvent`, `WebhookLog`, BullMQ e DLQ disputavam a interpretacao do estado final.
  - Solucao: banco fica como fonte canonica de estado de negocio/operacional; BullMQ fica como motor tecnico de tentativas; DLQ fica como area de intervencao manual. Nesta leva, `WebhookLog` sera a entrega canonica por config/outbox.
  - Validacao: revisao do item pelos subagents e registro do escopo neste documento.

- [x] 2.2 Evoluir schema/dominio de `WebhookLog`
  - Problema: cada tentativa criava uma linha nova sem `status`, `failedAt`, `lastError` ou unicidade por entrega.
  - Solucao: adicionar status explicito `PENDING | DELIVERED | FAILED_RETRYABLE | FAILED_FINAL`, `failedAt`, `lastError` e unique por `(configId, outboxEventId)`, preservando os campos publicos atuais.
  - Validacao: migration Prisma, client gerado e testes de entidade/repositorio cobrindo transicoes de entrega.

- [x] 2.3 Adaptar repositorio para entrega unica
  - Problema: `WebhookLogRepository.save()` sempre usava `create`, causando duplicidade e tentativa semanticamente incorreta.
  - Solucao: adicionar busca por `(configId, outboxEventId)`, `upsertDelivery`, consulta por outbox e marcacao de falha final; filtros passam a usar status canonico.
  - Validacao: specs de infrastructure cobrindo upsert, filtros por status e falha final por outbox.

- [x] 2.4 Ajustar `ProcessWebhookUseCase`
  - Problema: retries de um evento reenviavam configs ja entregues quando outra config falhava.
  - Solucao: reaproveitar a entrega existente, pular `DELIVERED`, atualizar tentativa existente em sucesso/falha e marcar outbox como `PROCESSED` quando todas as configs ativas estiverem entregues.
  - Validacao: specs de core cobrindo falha parcial, segunda execucao sem reenvio da config entregue e evento totalmente entregue sem envio novo.

- [x] 2.5 Fechar estado canonico na falha final do BullMQ
  - Problema: `WebhookProcessor.onFailed` movia para DLQ, mas o banco podia ficar `DISPATCHED` indefinidamente.
  - Solucao: em falha final, marcar entregas pendentes/retryable como `FAILED_FINAL`, marcar outbox como falha terminal e entao registrar DLQ.
  - Validacao: specs do worker cobrindo falha retryable sem efeito colateral e falha final atualizando banco antes da DLQ.

- [x] 2.6 Preservar politica de requeue da DLQ
  - Problema: `scripts/dlq.mjs` recriava jobs sem `attempts`, `backoff`, `jobId` e politica normal de fila.
  - Solucao: gravar/restaurar opcoes originais quando existirem, aplicar defaults seguros para webhook/alert legados e bloquear requeue quando job alvo ja existir sem `--force`.
  - Validacao: teste do helper de DLQ e `node --check scripts/dlq.mjs`.

- [x] 2.7 Refletir estado em timeline/API sem quebrar contrato
  - Problema: timeline/API derivavam estado apenas de `deliveredAt`, `responseStatus` e `attempt`.
  - Solucao: expor campos opcionais de estado de entrega e mapear `FAILED_RETRYABLE`/`FAILED_FINAL` de forma coerente mantendo campos antigos.
  - Validacao: specs de listagem/timeline existentes atualizadas e compatibilidade dos DTOs.

- [x] 2.8 Rodada final e commits semanticos
  - Problema: o item so fecha com suites focadas, build e historico separado das mudancas alheias.
  - Solucao: rodar `core`, `infrastructure`, `worker`, checagens necessarias do script e `pnpm build`; comitar por escopo sem incluir landing.
  - Validacao: comandos passam e `git status` mostra apenas arquivos fora do escopo ainda nao comitados.

### Criterios de corrigido

- [x] Nao existem webhooks duplicados para configs ja entregues durante retry de outra config.
- [x] Um job em `webhook-dead-letter` sempre tem estado correspondente no banco.
- [x] `OutboxEvent.status` nao fica indefinidamente `DISPATCHED` apos falha final.
- [x] Requeue de DLQ usa a mesma politica de retry/backoff do fluxo normal.
- [x] Timeline/dashboard consegue explicar o estado: pendente, entregue, falha retryable ou falha final.
- [x] `WebhookLog.attempt` reflete tentativa real na entrega canonica por config/outbox.

### Walkthrough de testes

1. [x] Rodar testes focados: `pnpm --filter @hockpay/core test:ci`, `pnpm --filter @hockpay/infrastructure test`, `pnpm --filter @hockpay/worker test`.
2. [x] Validar fluxo feliz por teste unitario: `ProcessWebhookUseCase` marca `OutboxEvent=PROCESSED` quando todas as configs entregam.
3. [x] Validar falha parcial por teste unitario: duas configs, uma ja entregue e outra falhando; retry tenta apenas a pendente.
4. [x] Validar DLQ por teste unitario do worker: falha final marca entregas como `FAILED_FINAL`, outbox como falha terminal e registra DLQ.
5. [x] Validar requeue por checagem de script/helper: `node --check scripts/dlq.mjs` e specs de payload DLQ preservando opcoes originais.
6. [x] Rodar `pnpm --filter @hockpay/api test` para contrato DTO/timeline.
7. [x] Rodar `pnpm build` no estado final.

### Tarefas reabertas pela auditoria 2026-05-22

- [x] 2.9.1 Definir contrato de reset canonico no requeue
  - Problema: requeue de DLQ hoje recria job sem preparar o estado persistido da entrega.
  - Solucao: documentar que apenas entregas nao `DELIVERED` do `outboxEventId` sao resetadas; `configIds` da DLQ limitam o reset quando existirem; alert DLQ fica fora desta rodada.
  - Validacao: este item registra a regra antes da implementacao e preserva entregas ja entregues.

- [x] 2.9.2 Resetar entregas de webhook para tentativa operacional
  - Problema: uma entrega `FAILED_FINAL` pode continuar com tentativa esgotada e falhar imediatamente apos requeue.
  - Solucao: adicionar metodo de dominio/repositorio para resetar `status=PENDING`, `attempt=0` e limpar `nextRetryAt`, `failedAt`, `lastError`, `responseStatus` e `responseBody`.
  - Validacao: specs de entidade/repositorio provam reset por `outboxEventId`, filtro por `configIds` e preservacao de `DELIVERED`.

- [x] 2.9.3 Resetar `OutboxEvent` para estado reprocessavel
  - Problema: o outbox pode permanecer em falha terminal enquanto o job foi reenfileirado.
  - Solucao: marcar o outbox como `DISPATCHED` ou estado equivalente de reprocessamento, limpar erro e preparar watchdog/retry sem criar duplicidade.
  - Validacao: spec prova que requeue nao deixa outbox terminal e nao abre caminho para dispatcher duplicar job imediatamente.

- [x] 2.9.4 Integrar reset ao `dlq requeue`
  - Problema: a ordem da operacao precisa evitar processamento com estado antigo e tambem evitar reset se o job alvo ja existe sem `--force`.
  - Solucao: validar DLQ job, montar opcoes, checar job alvo, resetar banco, adicionar job e remover DLQ apenas com `--remove`.
  - Validacao: teste do helper/script prova reset antes de `target.add` e depois do guard de job existente.

- [x] 2.10.1 Tipar status canonico no contrato web/API
  - Problema: o backend expoe status, mas o web nao tipa `status`, `failedAt` e `lastError`.
  - Solucao: adicionar union `PENDING | DELIVERED | FAILED_RETRYABLE | FAILED_FINAL` e campos opcionais ao tipo de log usado no dashboard.
  - Validacao: build/test web e API continuam tipando o DTO.

- [x] 2.10.2 Centralizar semantica visual de entrega
  - Problema: o template decide estado por HTTP status, o que confunde pendente, retryable e final.
  - Solucao: criar helpers `resolveLogStatus`, label, icon/classes, detail e `canRetryLog` usando status canonico com fallback legado.
  - Validacao: spec cobre os quatro status canonicos e fallback para log legado sem `status`.

- [x] 2.10.3 Atualizar historico de webhooks no dashboard
  - Problema: a UI nao mostra estado canonico nem detalhes como `lastError`, `failedAt` e `nextRetryAt`.
  - Solucao: atualizar o HTML para badge/status canonico e detalhes coerentes; manter filtro `Falhas` agregado.
  - Validacao: build web passa e fixture/spec garante que `PENDING` nao parece falha final por falta de HTTP status.

- [x] 2.10.4 Ajustar acao manual de retry
  - Problema: a UI mostra retry para qualquer log sem 2xx, incluindo pendentes.
  - Solucao: usar `canRetryLog` e permitir acao apenas para `FAILED_RETRYABLE` e `FAILED_FINAL`.
  - Validacao: spec garante sem retry para `PENDING`/`DELIVERED` e retry para falhas.

- [x] 2.11.1 Passar `configId` da rota para o use case
  - Problema: o retry manual ignora `:id` da URL.
  - Solucao: alterar input interno para incluir `configId` e fazer `WebhookController.retryLog` enviar `configId: id`.
  - Validacao: spec do controller verifica payload enviado ao use case.

- [x] 2.11.2 Validar config da rota antes do log
  - Problema: o use case usa a config do proprio log, permitindo retry via URL de outra config da mesma store.
  - Solucao: buscar config por `input.configId`, validar ownership da store e usar essa config para secret/url.
  - Validacao: specs cobrem config inexistente e config de outra store como `WEBHOOK_CONFIG_NOT_FOUND`.

- [x] 2.11.3 Mascarar log inexistente ou de outra config
  - Problema: `logId` de outra config da mesma store nao deve ser retryado.
  - Solucao: criar/usar erro `WEBHOOK_LOG_NOT_FOUND` quando log nao existe ou `log.configId !== config.id`.
  - Validacao: spec cobre log de outra config da mesma store sem chamar sender/update.

- [x] 2.12.1 Extrair helpers testaveis do script de DLQ
  - Problema: `buildRequeueOptions` e guards vivem como funcoes locais sem cobertura direta.
  - Solucao: mover funcoes puras/orquestracao injetavel para helper ESM e manter `dlq.mjs` como CLI fino.
  - Validacao: `node --check scripts/dlq.mjs` e `node --check scripts/dlq-helpers.mjs`.

- [x] 2.12.2 Cobrir opcoes e guards de requeue
  - Problema: defaults, overrides, `removeOnComplete`, `removeOnFail` e `--force` podem regredir sem teste.
  - Solucao: adicionar `node --test` para defaults webhook/alert, sanitizacao de opcoes, guard de job existente e `--force`.
  - Validacao: `node --test scripts/dlq-helpers.test.mjs` falha se requeue perder opcoes ou ignorar guard.

## 3. Gaps transacionais em auth/store/checkout

Status: concluido em 2026-05-20. A implementacao local foi concluida, comitada e validada com smoke P0 em infra descartavel.

Auditoria 2026-05-22: reaberto por validacao superdeclarada. A implementacao principal parece no lugar, mas os testes de checkout nao provam rollback real nem concorrencia real do claim.

Notas da implementacao:

- `MerchantRepository` e `RefreshTokenRepository` foram centralizados em `packages/infrastructure`, sem decorators Nest e com suporte a `PrismaClient | Prisma.TransactionClient`.
- `ITransactedRepositories` e `UnitOfWork` agora expõem `merchantRepository`, `refreshTokenRepository` e `checkoutSessionRepository`.
- `LoginUseCase`, `RefreshTokenUseCase`, `SwitchStoreUseCase` e `CreateStoreUseCase` executam rotacao de refresh token e updates relacionados dentro de `UnitOfWork`.
- `FulfillCheckoutSessionUseCase` faz claim atomico da sessao `OPEN`, cria o pagamento via `CreatePaymentUseCase.executeInTransaction` e salva a sessao `COMPLETED` na mesma transacao.
- O agendamento pos-commit do pagamento continua fora da transacao e so roda depois de `checkoutSessionRepository.save()` concluir com sucesso.
- O wiring Nest da API passou a usar `UnitOfWork` nos fluxos mutantes e repositorios centrais para leituras simples.

### Problema original

Antes dos commits `6f05d68` e `86773e0`, havia fluxos criticos que executavam multiplas escritas relacionadas sem uma fronteira transacional unica. As referencias abaixo descrevem o ponto de partida do item; algumas foram movidas ou refatoradas durante a implementacao.

Em auth/store, `CreateStoreUseCase`, `SwitchStoreUseCase`, `LoginUseCase` e `RefreshTokenUseCase` combinam `save/update`, revogacao de refresh tokens e criacao de novo refresh token em chamadas separadas. Referencias:

- `packages/core/src/application/use-cases/create-store.use-case.ts:86`
- `packages/core/src/application/use-cases/switch-store.use-case.ts:77`
- `packages/core/src/application/use-cases/login.use-case.ts:89`
- `packages/core/src/application/use-cases/refresh-token.use-case.ts:83`
- `apps/api/src/infra/repositories/refresh-token.repository.impl.ts:71`

Em checkout, `FulfillCheckoutSessionUseCase` cria pagamento via `CreatePaymentUseCase`, que usa `UnitOfWork`, mas so depois marca a sessao como fulfilled em outro write fora da transacao:

- `packages/core/src/application/use-cases/fulfill-checkout-session.use-case.ts:63`
- `packages/core/src/application/use-cases/fulfill-checkout-session.use-case.ts:77`

O `UnitOfWork` tambem nao oferecia `merchantRepository`, `refreshTokenRepository` nem `checkoutSessionRepository`:

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

- [x] 3.1 Revisar escopo e quebrar a execucao em subtarefas
  - Problema: o item misturava auth, store, checkout, repositorios e wiring em checkboxes grandes demais.
  - Solucao: separar em contrato transacional, repositorios centrais, auth/store, checkout, wiring, testes e validacao final.
  - Validacao: documento atualizado antes das alteracoes de codigo e subagents criados para revisar as frentes independentes.

- [x] 3.2 Expandir contrato transacional e repositorios centrais
  - Problema: `ITransactedRepositories` nao oferece `merchantRepository`, `refreshTokenRepository` ou `checkoutSessionRepository`, e merchant/refresh ainda vivem na API.
  - Solucao: mover/adaptar `MerchantRepository` e `RefreshTokenRepository` para `packages/infrastructure`, suportando `PrismaClient | Prisma.TransactionClient`; adicionar repos ao `UnitOfWork` e exporta-los.
  - Validacao: build de core/infrastructure e specs de repositorio/wiring compilando sem imports locais antigos.

- [x] 3.3 Adicionar locks operacionais minimos
  - Problema: refresh e fulfill concorrentes podem ler estado antigo e concluir duas rotacoes/pagamentos.
  - Solucao: adicionar metodos transacionais de lock para merchant, refresh token e checkout session via repositorios; em testes fake, esses metodos podem delegar para a leitura normal.
  - Validacao: specs de use case com fault-injection/concorrencia simulada provam vencedor unico ou rollback.

- [x] 3.4 Refatorar auth/store para `UnitOfWork`
  - Problema: login, refresh, switch store e create store fazem revogacao/criacao de token e update de merchant/store fora de uma unica transacao.
  - Solucao: construtores recebem `IUnitOfWork` para operacoes compostas; validacoes e writes relacionados rodam dentro de `unitOfWork.execute`; JWT/refresh token retornados seguem iguais.
  - Validacao: specs de core cobrem rollback em falha no ultimo write e token ja rotacionado.

- [x] 3.5 Refatorar checkout fulfill para `UnitOfWork`
  - Problema: `FulfillCheckoutSessionUseCase` cria pagamento por um UoW interno e salva sessao completed fora dele.
  - Solucao: executar claim/lock da sessao `OPEN`, criacao do payment via `CreatePaymentUseCase.executeInTransaction` e `session.fulfill/save` no mesmo UoW; agendamento de expiracao fica depois do commit.
  - Validacao: specs cobrem rollback quando salvar sessao falha e duplo fulfill da mesma sessao.

- [x] 3.6 Atualizar wiring Nest e remover dependencias locais obsoletas
  - Problema: `AuthModule`, `StoreModule`, `CheckoutSessionModule` e modulos auxiliares injetam repositorios diretos para operacoes compostas.
  - Solucao: usar `UnitOfWork` de `@hockpay/infrastructure` nos use cases mutantes e importar repos centrais para leituras simples; nao introduzir DynamicModules novos nesta leva.
  - Validacao: `pnpm --filter @hockpay/api test` e build resolvem providers.

- [x] 3.7 Rodada final e commits semanticos
  - Problema: a mudanca cruza camadas e precisa ficar separada das alteracoes de landing.
  - Solucao: rodar core, infrastructure, api e build; comitar por escopo sem incluir arquivos da landing.
  - Validacao: comandos passam e `git status` final mostra apenas alteracoes fora do escopo.

- [x] 3.8 Validar smoke P0 em infra descartavel
  - Problema: testes unitarios/build validam a fronteira transacional, mas ainda falta exercitar o fluxo integrado com API/worker/infra em processo limpo.
  - Solucao: subir ambiente descartavel com API e worker recem-buildados e executar `pnpm run smoke:p0`.
  - Validacao: `HOCKPAY_SMOKE_SUITE=p0 pnpm run smoke:docker` passou, subindo Postgres/Redis descartaveis, aplicando migrations, iniciando API/worker/checkout e executando `smoke:p0`.

### Criterios de corrigido

- [x] Nenhum dos fluxos revisados faz multiplas escritas relacionadas fora de uma mesma transacao.
- [x] Falha simulada entre revogar token e criar token novo nao apaga o refresh token anterior.
- [x] Falha simulada apos criar store nao deixa merchant/token em estado parcial.
- [x] Falha simulada apos criar payment em checkout nao deixa payment/pix/outbox persistidos sem sessao completed.
- [x] Duplo fulfill concorrente da mesma sessao gera no maximo um payment.
- [x] O wiring Nest dos fluxos mutantes usa `IUnitOfWork`, nao repositorios diretos, para operacao composta.
- [x] Smoke P0 em infra descartavel confirma que os fluxos integrados continuam funcionando com API/worker reais.

### Walkthrough de testes

1. [x] Rodar unit tests novos no core com repositorios fake/fault-injection para `Login`, `RefreshToken`, `SwitchStore`, `CreateStore` e `FulfillCheckoutSession`.
2. [x] Validar rollback: erro no ultimo write da transacao deve deixar estado anterior intacto.
3. [x] Validar concorrencia operacional: refresh ja rotacionado falha sem novo token e duplo fulfill por claim atomico gera no maximo um pagamento.
4. [x] Rodar `pnpm --filter @hockpay/core test:ci`.
5. [x] Rodar `pnpm --filter @hockpay/infrastructure test`.
6. [x] Rodar `pnpm --filter @hockpay/api test`.
7. [x] Rodar `pnpm build`.
8. [x] Em ambiente descartavel com infra local e API/worker recem-subidos, rodar `HOCKPAY_SMOKE_SUITE=p0 pnpm run smoke:docker`.

### Tarefas reabertas pela auditoria 2026-05-22

- [ ] 3.9 Provar rollback de checkout apos criar payment
  - Problema: a spec atual mocka `CreatePaymentUseCase` e usa `UnitOfWork` fake sem snapshot/rollback, entao nao prova que payment/pix/outbox somem quando salvar a sessao falha.
  - Solucao: adicionar teste com transacao real ou fixture que exercite o caminho completo de `FulfillCheckoutSessionUseCase` e force falha depois da criacao do pagamento.
  - Validacao: assert confirma que nao ha `Payment`, `PixCharge` ou `OutboxEvent` persistidos sem checkout session `COMPLETED`.

- [ ] 3.10 Provar duplo fulfill concorrente contra claim real
  - Problema: a spec simula `claimOpenByToken` retornando uma sessao uma vez e `null` depois, mas nao exercita duas transacoes concorrentes sobre o repositorio real.
  - Solucao: adicionar teste de concorrencia com PostgreSQL real ou smoke opt-in que chame fulfill duas vezes em paralelo para a mesma session.
  - Validacao: apenas uma chamada cria pagamento e completa a sessao; a outra retorna erro/estado esperado sem segundo payment.

## 4. Store creation, auth hydration, refresh waiters e withdrawals

Status: concluido em 2026-05-20. Criacao de loja agora atualiza access/refresh cookies, o web trata create-store como troca de tenant, auth passa a hidratar perfil completo, refresh concorrente propaga falha para todos os waiters e withdrawals usa contexto de store estruturado.

Auditoria 2026-05-22: follow-ups concluidos. O filtro HTTP preserva `NO_CURRENT_STORE` no formato Nest esperado, endpoints idempotentes com JWT sem store retornam `403 NO_CURRENT_STORE`, e withdrawals sem store tem cobertura HTTP para `GET` e `POST`.

Notas da implementacao:

- `StoreController.createStore` grava `hockpay_at` e `hockpay_rt` com a mesma semantica de sessao de login/switch-store.
- `WithdrawalController` passou a receber `@CurrentStore()` em `create`, `list` e `get`; a resolucao compartilhada retorna 403 estruturado `NO_CURRENT_STORE`.
- `AuthService.login()` hidrata `/merchants/me` antes de popular estado autenticado e `checkAuthStatus()` recupera perfil quando auth esta true mas `currentUser` esta vazio.
- O refresh in-flight agora e um observable compartilhado com `shareReplay`, limpa o estado ao finalizar e propaga erro para todos os inscritos.
- `StoreService.createStore()` atualiza lista/currentStore, reidrata auth e redireciona para dashboard como troca de tenant; o dialog nao faz reload redundante da lista.
- `WithdrawalDetail.complete()` e `fail()` limpam `actionLoading` quando o usuario cancela os confirms TEST.

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

- [x] 4.1 API: alinhar cookies de create-store e erro estruturado de withdrawals
  - Problema: `POST /stores` grava apenas `hockpay_rt`, e withdrawals usa `getStoreId(req)` com `Error` cru quando nao ha loja.
  - Solucao: gravar tambem `hockpay_at` com as mesmas opcoes de `login`/`switch-store`; trocar `create/list/get` de withdrawals para `@CurrentStore()` ou erro 403 estruturado.
  - Validacao: specs da API cobrem `Set-Cookie` de create-store e ausencia de loja retornando `NO_CURRENT_STORE`.

- [x] 4.2 Web auth: hidratar perfil completo e corrigir refresh concorrente
  - Problema: login deixa `currentUser` parcial e `refreshSubject` prende waiters quando refresh falha.
  - Solucao: carregar `/merchants/me` apos login e expor hidratacao forcada; substituir o waiter por refresh in-flight compartilhado que propaga erro para todos.
  - Validacao: specs do `AuthService` cobrem login hidratado e multiplos waiters recebendo erro em falha de refresh.

- [x] 4.3 Web store: tratar create-store como troca de tenant
  - Problema: criar loja so troca `currentStore` em memoria e pode deixar access cookie/estado store-scoped antigos ate reload/refresh.
  - Solucao: apos create-store, atualizar lista/currentStore, hidratar usuario e aplicar a mesma semantica de troca de tenant usada em switch-store.
  - Validacao: spec do `StoreService` confirma nova loja selecionada, `currentUser.currentStoreId` atualizado por hidratacao e navegacao/reload controlada.

- [x] 4.4 Web withdrawals: corrigir dependencias de auth e cancelamento dos confirms TEST
  - Problema: withdrawals depende de documento hidratado e os botoes TEST ficam travados quando `confirm()` e cancelado.
  - Solucao: garantir uso de perfil hidratado antes de criar conta Pix e limpar `actionLoading` em cancelamento de `complete()`/`fail()`.
  - Validacao: specs cobrem cancelamento de ambos os confirms e botao reabilitado.

- [x] 4.5 Cobertura focada para API e web
  - Problema: a regressao envolve cookies, estado reativo e erro concorrente, pontos que nao estavam cobertos.
  - Solucao: adicionar/ajustar testes pequenos nos controllers/services afetados sem criar suite pesada.
  - Validacao: `pnpm --filter @hockpay/api test` e specs web direcionadas passam.

- [x] 4.6 Validacao final, docs e commits semanticos
  - Problema: a mudanca cruza API e web e precisa ficar separada das alteracoes de landing.
  - Solucao: rodar testes/build relevantes, atualizar checkboxes do item 4 e comitar por escopo sem incluir landing.
  - Validacao: comandos passam e `git status` final mostra apenas arquivos fora do escopo ainda nao comitados.

### Criterios de corrigido

- [x] Criar loja retorna `Set-Cookie` para `hockpay_at` e `hockpay_rt`.
- [x] Depois de criar loja, chamadas imediatas a `/accounts/me`, `/bank-accounts` e `/withdrawals` usam a nova loja sem esperar expiracao do access token.
- [x] Depois de login, `currentUser.document`, `formattedDocument`, `documentType` e `currentStoreId` estao preenchidos antes de abrir withdrawals.
- [x] Falha de refresh simultanea nao deixa requests pendurados; todos recebem erro e auth vai para `false`.
- [x] Withdrawal sem store selecionada retorna 403 estruturado, nao 500.
- [x] Cancelar "Completar" ou "Falhar" em detalhe de saque reabilita os botoes.

### Walkthrough de testes

1. [x] Rodar testes direcionados de API/web adicionados para os pontos acima.
2. [x] Rodar `pnpm --filter @hockpay/api test` e `pnpm --filter @hockpay/core test:ci`.
3. [x] Rodar build/test web aplicavel: `pnpm --filter @hockpay/web build` e `pnpm --filter @hockpay/web test`.
4. [x] Validar contrato HTTP de create-store por `pnpm --filter @hockpay/api test:e2e`.
5. [x] Validar fluxo integrado com infra descartavel por `HOCKPAY_SMOKE_SUITE=p0 pnpm run smoke:docker`.
6. [x] Validar concorrencia de refresh por spec do `AuthService` com multiplos waiters recebendo a mesma falha sem spinner pendurado.

### Tarefas reabertas pela auditoria 2026-05-22

- [x] 4.7.1 Preservar `NO_CURRENT_STORE` no JSON final do filtro HTTP
  - Problema: `CurrentStore` lanca `ForbiddenException` com `code` no topo do response, mas `HttpExceptionFilter` so preserva codigo customizado em `{ error: { code, message } }`; o HTTP final tende a virar `FORBIDDEN`.
  - Solucao: ampliar o filtro para preservar `responseObj.code` top-level quando existir, sem quebrar o formato nested `{ error: { code, message } }` nem excecoes genericas.
  - Validacao: spec do filtro confirma `error.code === "NO_CURRENT_STORE"` para `ForbiddenException` top-level e `FORBIDDEN` para forbidden generico.

- [x] 4.7.2 Preservar `NO_CURRENT_STORE` em endpoints idempotentes com JWT sem store
  - Problema: em `POST /withdrawals`, o `IdempotencyInterceptor` roda antes do decorator `@CurrentStore()` e pode retornar `IDEMPOTENCY_STORE_REQUIRED`.
  - Solucao: quando houver JWT autenticado sem `storeId`, retornar `403 NO_CURRENT_STORE`; manter `IDEMPOTENCY_STORE_REQUIRED` para request com `Idempotency-Key` mas sem contexto autenticado/store.
  - Validacao: spec do interceptor cobre JWT sem store, ausencia total de store e store valido.

- [x] 4.8.1 Cobrir `GET /api/v1/withdrawals` sem store em teste HTTP
  - Problema: a cobertura atual chama controller/decorator diretamente e nao valida `@CurrentStore()` junto com guards/filtro global em rota real.
  - Solucao: adicionar teste HTTP/e2e com JWT valido sem `storeId`, `WithdrawalController`, guard real/mocado e filtros globais.
  - Validacao: `GET /api/v1/withdrawals` retorna 403 estruturado com `NO_CURRENT_STORE`, nao 500 nem `FORBIDDEN` generico.

- [x] 4.8.2 Cobrir `POST /api/v1/withdrawals` sem store em teste HTTP
  - Problema: `POST /withdrawals` combina `@CurrentStore()` e `@Idempotent`, entao a cobertura precisa provar que o erro e de store/contexto, nao de header ou body.
  - Solucao: adicionar teste HTTP/e2e com JWT valido sem `storeId`, body valido e `Idempotency-Key`.
  - Validacao: `POST /api/v1/withdrawals` retorna 403 estruturado com `NO_CURRENT_STORE` e nao chama use case/idempotency operation.

## 5. PrismaService, migrations, claims e invariantes de banco

Status: concluido em 2026-05-22. Esta leva corrigiu a autoridade transacional no banco: Prisma singleton por app, artefatos Prisma no build, claims atomicos no worker e locks de saldo nos fluxos financeiros. A suite opt-in `db-concurrency` cobre `FOR UPDATE SKIP LOCKED` e saldo concorrente com Postgres real; `withdrawals,p0` passou em infra descartavel. O orquestrador de smoke tambem aceita `HOCKPAY_SMOKE_API_PORT` para evitar conflito com outro processo local sem matar servicos fora do projeto.

Auditoria 2026-05-22: follow-ups concluidos. O smoke `db-concurrency` agora exercita `OutboxRepository` e `WithdrawalRepository` reais, e o contrato de deploy por artefato Prisma explicita `DATABASE_URL` no ambiente.

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

- [x] 5.1 Prisma compartilhado e artefatos de deploy
  - Problema: API e worker duplicam `PrismaService`, e o build de `@hockpay/database` nao publica schema/migrations/config.
  - Solucao: criar `@hockpay/database/nest` com `PrismaService`/`PrismaModule`, manter entrypoint principal puro, reexportar via shims nos apps e copiar artefatos Prisma para `dist`.
  - Validacao: `pnpm --filter @hockpay/database build` gera `dist/prisma/schema.prisma`, `dist/prisma/migrations` e `dist/prisma.config.ts`.

- [x] 5.2 Provider Prisma unico na API
  - Problema: modulos de negocio registram `PrismaService` localmente apesar do `PrismaModule` global.
  - Solucao: remover `PrismaService` dos `providers` dos modulos que redeclaram provider, mantendo imports apenas para `inject/useFactory`.
  - Validacao: `rg -n "^\\s*PrismaService,\\s*$" apps/api/src/modules -g "*.module.ts"` nao retorna resultados e teste guard cobre a regra.

- [x] 5.3 Claim atomico de outbox
  - Problema: o dispatcher seleciona eventos com `findMany` e so marca `DISPATCHED` depois do enqueue, permitindo dois workers selecionarem o mesmo evento.
  - Solucao: adicionar `claimDispatchableEvents({ limit, now, watchdogUntil })` com `FOR UPDATE SKIP LOCKED` e `UPDATE ... RETURNING`; o job enfileira apenas eventos claimados.
  - Validacao: specs de repository/job e teste concorrente real garantem ids disjuntos entre dois claimers.

- [x] 5.4 Claim atomico de withdrawals
  - Problema: withdrawals processaveis sao lidas sem claim, e `alreadyProcessing` nao bloqueia payout no job.
  - Solucao: adicionar `claimProcessableWithdrawals({ limit, now, staleProcessingBefore })`, claim batch transacional com outbox `withdrawal.processing`, e job processando apenas linhas claimadas.
  - Validacao: specs de repository/job/use case e teste concorrente real garantem uma unica transicao para `PROCESSING`.

- [x] 5.5 Locks financeiros por `FOR UPDATE`
  - Problema: saldos sao alterados por read-modify-write e `AccountRepository.update` sobrescreve valores absolutos.
  - Solucao: adicionar leituras `find...ForUpdate` para Account/Payment/PixCharge/Withdrawal e usar esses locks nos use cases financeiros dentro do `UnitOfWork`.
  - Validacao: specs provam uso dos locks e testes concorrentes nao deixam saldo perdido/negativo.

- [x] 5.6 Indices para claims e locks
  - Problema: claims com filtros por status/data precisam de indices coerentes para nao degradar o worker.
  - Solucao: adicionar migration com indices para outbox dispatchable e withdrawals processable/stale.
  - Validacao: `pnpm db:generate`, build e testes de repository passam com schema atualizado.

- [x] 5.7 Cobertura concorrente e smoke
  - Problema: testes mockados nao provam `SKIP LOCKED` nem lost updates em Postgres real.
  - Solucao: adicionar suite opt-in `db-concurrency` para outbox, withdrawals e saldo concorrentes, alem de unitarios focados.
  - Validacao: comandos focados, `HOCKPAY_SMOKE_SUITE=db-concurrency HOCKPAY_SMOKE_API_PORT=3010 pnpm run smoke:docker` e `HOCKPAY_SMOKE_SUITE=withdrawals,p0 HOCKPAY_SMOKE_API_PORT=3010 pnpm run smoke:docker` passam.

- [x] 5.8 Rodada final e commits semanticos
  - Problema: a mudanca cruza packages, API, worker e schema, entao precisa fechar com validacao ampla e historico claro.
  - Solucao: rodar suites relevantes, atualizar este documento e comitar por escopo.
  - Validacao: `pnpm build`, smokes opt-in/integrados e commits semanticos por grupo.

### Criterios de corrigido

- [x] So `PrismaModule` registra `PrismaService` por app.
- [x] `pnpm --filter @hockpay/database build` gera `dist` com client, schema e migrations.
- [x] Dois workers concorrentes nao claimam o mesmo outbox event ou withdrawal.
- [x] `alreadyProcessing` nao dispara payout.
- [x] Saldos nao tem lost update em confirmacoes, releases, refunds e withdrawals concorrentes.
- [x] `pnpm db:deploy` funciona a partir do artefato esperado de deploy.

### Walkthrough de testes

1. [x] Rodar `pnpm db:generate`.
2. [x] Rodar `pnpm --filter @hockpay/database build` e verificar `dist/prisma/schema.prisma`, `dist/prisma/migrations`, `dist/prisma.config.ts` e `dist/nest/index.js`.
3. [x] Rodar testes unitarios de core, API, worker e infrastructure.
4. [x] Adicionar teste concorrente de outbox com dois claimers e assert de ids distintos pela suite opt-in `db-concurrency`.
5. [x] Adicionar teste concorrente de withdrawals com dois claimers e assert de uma unica transicao para `PROCESSING` pela suite opt-in `db-concurrency`.
6. [x] Adicionar teste de saldo com dois saques simultaneos e assert de saldo final/bloqueado pela suite opt-in `db-concurrency`.
7. [x] Rodar smoke de withdrawals e P0 apos subir Postgres/Redis e aplicar migrations: `HOCKPAY_SMOKE_SUITE=withdrawals,p0 HOCKPAY_SMOKE_API_PORT=3010 pnpm run smoke:docker`.

### Tarefas reabertas pela auditoria 2026-05-22

- [x] 5.9.1 Trocar SQL duplicado por repositorios reais no smoke `db-concurrency`
  - Problema: o smoke valida SQL local reimplementado, enquanto os repositorios de producao usam seus proprios metodos/SQL; isso permite drift entre teste e runtime.
  - Solucao: remover helpers locais de claim e chamar `OutboxRepository.claimDispatchableEvents` e `WithdrawalRepository.claimProcessableWithdrawals` em duas instancias sobre dois `PrismaClient`s.
  - Validacao: busca no script nao encontra helpers/SQL local de claim e confirma uso dos metodos reais.

- [x] 5.9.2 Tornar fixtures do smoke deterministicas contra claims globais
  - Problema: os metodos reais claimam linhas elegiveis globalmente, nao por `requestId` ou `withdrawalId`.
  - Solucao: executar claim de outbox antes do setup HTTP, semear linhas com `createdAt` antigo e assertar que os IDs claimados batem exatamente com os IDs semeados; manter saldo concorrente via HTTP inalterado.
  - Validacao: `db-concurrency` falha claramente se claimar linha alheia ou duplicar ID.

- [x] 5.9.3 Validar smoke `db-concurrency` com repositorios reais
  - Problema: a suite so fecha quando roda contra Postgres/Redis reais e pacote infrastructure buildado.
  - Solucao: rodar build de infrastructure, `node --check`, varreduras textuais e smoke opt-in.
  - Validacao: `HOCKPAY_SMOKE_SUITE=db-concurrency HOCKPAY_SMOKE_API_PORT=3010 pnpm run smoke:docker` passa.

- [x] 5.10.1 Documentar contrato de `DATABASE_URL` para deploy por artefato Prisma
  - Problema: `resolve(__dirname, "../../.env")` aponta para a raiz no fonte, mas em `dist/prisma.config.ts` aponta para `packages/.env`; deploy baseado no artefato depende de `DATABASE_URL` injetado.
  - Solucao: documentar no runbook e README da API que `pnpm run db:deploy` em source workspace pode usar `.env` raiz, mas artifact deploy com `packages/database/dist/prisma.config.ts` exige `DATABASE_URL` exportado no ambiente.
  - Validacao: docs nao sugerem depender de descoberta de `.env` a partir de `dist`.

- [x] 5.10.2 Validar config Prisma de artifact com `DATABASE_URL`
  - Problema: a documentacao precisa ser reproduzivel e o build precisa continuar emitindo schema/config.
  - Solucao: rodar build do database e validar o config em `packages/database/dist` com `DATABASE_URL` explicito.
  - Validacao: `pnpm --filter @hockpay/database build` passa e `prisma validate --config prisma.config.ts` funciona em `dist` com `DATABASE_URL` no ambiente.

## 6. Docs, env e contratos apos redesign da landing

Status: concluido em 2026-05-22. Landing, READMEs, runbook e env examples foram alinhados ao contrato real `/api/v1`, sem alterar DTOs, Prisma schema ou runtime. Varreduras publicas ficaram limpas fora deste checklist; builds/testes focados passaram. O smoke integrado precisou de `HOCKPAY_SMOKE_API_PORT=3010` porque `3000` estava ocupada e de `HOCKPAY_SMOKE_TIMEOUT_MS=180000` para a suite `system` em volume default; com isso completou `p0,payment-link,p3,studycase,system,withdrawals`.

Auditoria 2026-05-22: reaberto para ajustes de docs/env. O contrato publico parece alinhado, mas os defaults de smoke e a matriz de env ainda nao refletem totalmente o runner.

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

- [x] 6.1 Landing usa exemplo REST copiavel
  - Problema: a landing mostra pseudo-SDK e endpoint sem `/api/v1`.
  - Solucao: trocar o bloco visual por `POST /api/v1/payments` com headers reais, `paymentMethod: "PIX"`, `customer.email` e `customer.document`.
  - Validacao: busca textual nao encontra pseudo-SDK ou endpoint antigo fora deste checklist; build do web passa.

- [x] 6.2 Landing usa status e eventos reais
  - Problema: exemplos publicos citam status/eventos inexistentes.
  - Solucao: usar `CONFIRMED` e eventos de `ALLOWED_WEBHOOK_EVENTS`, mantendo a estrutura visual do redesign.
  - Validacao: busca textual nao encontra eventos removidos fora deste checklist.

- [x] 6.3 API README documenta contrato real de payments
  - Problema: exemplos de pagamento e idempotencia estao incompletos para copia.
  - Solucao: incluir `paymentMethod`, `Idempotency-Key`, `customer.document`, refund idempotente e eventos permitidos.
  - Validacao: busca confirma `POST /api/v1/payments`, `Idempotency-Key`, `paymentMethod` e `customer.document`.

- [x] 6.4 Docs distinguem simulacoes TEST e checkout dev UI
  - Problema: os dois contratos de simulacao podem ser confundidos.
  - Solucao: documentar `/api/v1/dev/simulate/:id/:action` autenticado TEST e `/api/v1/payments/:id/simulate/:action` com `checkoutToken`.
  - Validacao: READMEs e runbook citam os dois contratos com auth/body corretos.

- [x] 6.5 Matriz de env cobre root/API/worker/checkout/demo/smoke
  - Problema: variaveis lidas pelo runtime aparecem dispersas e com Redis ambiguo.
  - Solucao: adicionar matriz por app no runbook e normalizar READMEs.
  - Validacao: comparar a matriz com `process.env`, `ConfigService`, `NEXT_PUBLIC_`, `HOCKPAY_`, `WORKER_CRON_` e `REDIS_` no codigo.

- [x] 6.6 Env examples usam apenas placeholders seguros
  - Problema: nao ha fonte local unica de exemplo de env na raiz.
  - Solucao: criar/atualizar `.env.example` raiz e alinhar `apps/demo-mediakit/.env.example` sem copiar segredos reais.
  - Validacao: revisar examples manualmente e garantir que contem apenas placeholders locais.

- [x] 6.7 Docs gerais removem shorthand publico incorreto
  - Problema: `docs/CURRENT_STATE.md` ainda usa shorthand de endpoint em uma linha de maturidade.
  - Solucao: trocar por `POST /api/v1/payments` e adicionar ponteiro curto no README raiz para runbook/env matrix.
  - Validacao: busca textual nao encontra `POST /payments` fora deste checklist.

- [x] 6.8 Validacao focada e smoke integrado
  - Problema: a correcao e documental, mas exemplos precisam ser conferidos contra build/testes existentes.
  - Solucao: rodar varreduras obrigatorias, builds/testes focados e `smoke:docker`.
  - Validacao: registrar resultados no fechamento do item.

### Criterios de corrigido

- [x] Nenhum exemplo copiavel usa endpoint sem `/api/v1`, salvo rotas do frontend como `/pay/:token` ou checkout `/:token`.
- [x] `rg` nao encontra `scenario: 'paid'`, `webhook.sent` ou `retry.safe` em exemplos tratados como contrato.
- [x] Todo exemplo de `POST /api/v1/payments` inclui `Idempotency-Key` e `customer.document`.
- [x] READMEs distinguem claramente `/api/v1/dev/simulate/:id/:action` de `/api/v1/payments/:id/simulate/:action`.
- [x] Matriz de env cobre todas as variaveis realmente lidas pelo runtime e explica o split `REDIS_URL` vs `REDIS_HOST`/`REDIS_PORT`.
- [x] Landing, docs e demo usam apenas eventos presentes em `ALLOWED_WEBHOOK_EVENTS`.

### Walkthrough de testes

1. [x] Rodar varredura textual:

   ```bash
   rg -n "scenario:|webhook.sent|retry.safe|POST /payments|/payments/:id/simulate|/dev/simulate|REDIS_URL|CHECKOUT_BASE_URL|PUBLIC_API_BASE_URL" README.md docs apps/*/README.md apps/web/src/app/features/landing/pages/home/home.html
   ```

2. [x] Conferir matriz de env contra o codigo:

   ```bash
   rg -n "process.env|ConfigService|get<string>|NEXT_PUBLIC_|HOCKPAY_" apps/api/src apps/worker/src apps/checkout/src apps/demo-mediakit
   ```

3. [x] Validar builds/testes focados:

   ```bash
   pnpm --filter @hockpay/web build
   pnpm --filter @hockpay/checkout build
   pnpm --filter @hockpay/demo-mediakit build
   pnpm --filter @hockpay/api test
   pnpm --filter @hockpay/worker test
   ```

4. [x] Validar fluxo integrado:

   ```bash
   HOCKPAY_SMOKE_API_PORT=3010 HOCKPAY_SMOKE_TIMEOUT_MS=180000 pnpm run smoke:docker
   ```

5. [x] Fazer checagem manual final na landing: exemplo visivel deve bater com os READMEs e nao parecer SDK/contrato inexistente.

### Tarefas reabertas pela auditoria 2026-05-22

- [ ] 6.9 Alinhar timeout do smoke default em `.env.example` e runbook
  - Problema: a validacao final precisou de `HOCKPAY_SMOKE_TIMEOUT_MS=180000`, mas `.env.example` combina a suite default completa com `HOCKPAY_SMOKE_TIMEOUT_MS=60000`.
  - Solucao: ajustar o placeholder/default documentado ou explicar claramente quando usar timeout maior para a suite `system` em volume default.
  - Validacao: `.env.example`, runbook e status do item nao se contradizem sobre o comando reproduzivel do smoke integrado.

- [ ] 6.10 Completar matriz de env dos smokes no runbook
  - Problema: a matriz de smoke nao lista todas as variaveis lidas pelo runner, como health/request timeouts, portas, Postgres smoke, suite, migrate mode, clean volumes e keep alive.
  - Solucao: expandir a tabela de smokes com todas as variaveis lidas por `scripts/smoke-orchestrate-local.mjs`, mantendo defaults/placeholders seguros.
  - Validacao: busca por `HOCKPAY_SMOKE_` no runner bate com a matriz do runbook ou cada excecao fica justificada.
