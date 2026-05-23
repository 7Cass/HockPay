# Hockpay - Current Working Items

Source repo: `/Users/jpcass/Documents/2026/hockpay`
Last reviewed: `2026-05-23`
Ordering: risco primeiro
Scope: P0-P2 validados; sem P3/futuro nesta versao

Este arquivo e o tracker executavel dos itens atuais de review. Cada macro item deve ser tratado como unidade de planejamento; as checkboxes dentro de `Subtasks` sao as unidades executaveis de implementacao e validacao.

## Status Legend

- `nao iniciado`
- `em planejamento`
- `em implementacao`
- `em validacao/hardening`
- `concluido`

## Priority Legend

- `P0`: risco de integridade, seguranca, credito duplicado, estado financeiro incorreto ou simulacao publica perigosa.
- `P1`: confiabilidade operacional, CI, consistencia relevante de produto ou UX operacional material.
- `P2`: acabamento, docs drift, acessibilidade, clareza e inconsistencias de menor risco.

## Intake Snapshot

- Branch atual no review: `main`, `ahead 1` de `origin/main`.
- Dirty work preexistente: `apps/web/src/app/features/dashboard/pages/overview/overview.html`.
- Tracker anterior: nenhum `CURRENT_WORKING_ITEMS.md`, `WORKING_REVIEW_ITEMS.md` ou `REVIEW_ITEMS.md` encontrado.
- Docs canonicos considerados: `README.md`, `docs/CURRENT_STATE.md`, `docs/PRODUCT.md`, `docs/DATA_MODEL.md`, `docs/RUNBOOK.md`, `docs/TARGET_ARCHITECTURE.md`.

## P0 - Integridade, Concorrencia e Simulacao Publica

### P0.1 Harden public Payment Link simulation endpoints

Status: `nao iniciado`

Problema: rotas publicas `POST /payment-links/public/:token/pay` e `/fail` mutam estado por token, sem idempotencia, sem enforcement claro de TEST/dev-only e com risco de gerar confirmacoes/falhas indevidas.

Impacto: um token publico valido pode disparar simulacoes que criam tentativas, outbox, webhooks e credito de saldo em condicoes que deveriam ser restritas ao ambiente TEST/dev.

Evidencia:

- `apps/api/src/modules/payment-link/payment-link.controller.ts`
- `packages/core/src/application/use-cases/pay-payment-link.use-case.ts`
- `apps/checkout/src/components/checkout/PaymentLinkPage.tsx`

Subtasks:

- [ ] P0.1.1 Enforce backend-side TEST/dev-only para `pay` e `fail`, rejeitando LIVE antes de criar payment/outbox.
  - Problema: a rota publica recebe token e executa mutacao antes de uma barreira explicita de ambiente.
  - Solucao: validar ambiente no use case, com erro de negocio mapeado pelo controller, antes de criar `Payment` ou `OutboxEvent`.
  - Validacao: teste de use case/controller prova que LIVE rejeita sem chamar `paymentRepository.save` nem `outboxWriter.save`.
- [ ] P0.1.2 Adicionar idempotencia ou claim atomico para chamadas publicas de simulacao de link.
  - Problema: chamadas repetidas podem criar multiplas tentativas para a mesma cobranca.
  - Solucao: usar idempotencia explicita ou claim/lock transacional do link/PixCharge antes da criacao da tentativa.
  - Validacao: chamadas repetidas com mesmo token nao geram duas confirmacoes efetivas.
- [ ] P0.1.3 Garantir throttling efetivo nessas rotas publicas, validando se `ThrottlerModule` esta realmente aplicado.
  - Problema: o modulo de throttling existe, mas precisa estar aplicado nas rotas publicas sensiveis.
  - Solucao: registrar guard/throttle efetivo para `pay` e `fail`, com limites adequados para simulacao.
  - Validacao: teste e2e/controller cobre excesso de chamadas e resposta de rate limit.
- [ ] P0.1.4 Atualizar checkout publico para respeitar `actions.canPay` e `actions.canFail`.
  - Problema: a UI expõe simulacoes baseada em dev mode/loading, ignorando flags do backend.
  - Solucao: esconder ou desabilitar botoes conforme `actions.canPay` e `actions.canFail`.
  - Validacao: teste do componente cobre flags falsas e ausencia de chamada ao client.
- [ ] P0.1.5 Adicionar testes unitarios/controller para LIVE rejeitado, TEST permitido e nenhuma chamada a `paymentRepository.save` quando rejeitado.
  - Problema: a cobertura atual valida fluxo feliz, mas nao os limites de ambiente.
  - Solucao: adicionar casos negativos e positivos focados.
  - Validacao: testes focados de core/API passam.
- [ ] P0.1.6 Adicionar teste concorrente de mesmo token garantindo uma unica confirmacao efetiva.
  - Problema: concorrencia pode creditar saldo mais de uma vez.
  - Solucao: criar teste DB-backed ou smoke de concorrencia para pay simultaneo do mesmo link.
  - Validacao: o teste prova um unico payment confirmado, um unico receipt, uma unica transaction de credito e saldo incrementado uma vez.

Done Criteria:

- [ ] LIVE nao consegue simular pay/fail por rota publica.
- [ ] Chamadas duplicadas/concorrrentes nao creditam saldo duas vezes.
- [ ] Checkout esconde/desabilita acoes quando `actions` negar.
- [ ] Testes focados passam.

### P0.2 Normalize payment/PixCharge transition locking

Status: `nao iniciado`

Problema: `confirm` usa locks, mas `expire`, `fail` e lazy expiration em reads usam leituras sem `FOR UPDATE`, permitindo corrida entre confirmacao, falha e expiracao.

Impacto: estados terminais podem disputar entre si, gerando ledger/account/outbox incoerentes ou sobrescrita de estado apos confirmacao.

Evidencia:

- `packages/core/src/application/use-cases/confirm-payment.use-case.ts`
- `packages/core/src/application/use-cases/expire-payment.use-case.ts`
- `packages/core/src/application/use-cases/fail-payment.use-case.ts`
- `packages/core/src/application/use-cases/get-payment.use-case.ts`

Subtasks:

- [ ] P0.2.1 Trocar terminal transitions de `expire` e `fail` para repositorios `ForUpdate`.
  - Problema: `expire` e `fail` leem sem lock e depois atualizam.
  - Solucao: usar metodos `findById...ForUpdate` para `Payment` e `PixCharge` em transicoes terminais.
  - Validacao: testes unitarios verificam chamadas aos repositorios com lock.
- [ ] P0.2.2 Incluir lazy expiration de `get payment` na mesma politica de lock ou remover mutacao do read path.
  - Problema: read path pode mutar estado com leitura sem lock.
  - Solucao: usar lock quando lazy expiration for mantida ou mover expiracao para use case/job separado.
  - Validacao: teste cobre GET de payment expirado sem corrida e com estado final consistente.
- [ ] P0.2.3 Em `confirm`, exigir `PixCharge.OPEN` antes de creditar, nao apenas marcar `PAID` condicionalmente.
  - Problema: `confirm` pode creditar mesmo quando `PixCharge` ja nao esta aberta.
  - Solucao: validar estado da PixCharge travada antes de `payment.confirm()` e antes de atualizar saldo.
  - Validacao: teste rejeita confirmacao com PixCharge `PAID`, `EXPIRED` ou `CANCELLED`.
- [ ] P0.2.4 Avaliar e adicionar constraint/partial index para impedir mais de um payment confirmado por `pixChargeId`.
  - Problema: schema indexa `pixChargeId`, mas nao impede multiplos payments confirmados no mesmo PixCharge.
  - Solucao: adicionar constraint/partial index compativel com tentativas falhas permitidas.
  - Validacao: migration/teste DB prova multiplas falhas permitidas e confirmacao duplicada bloqueada.
- [ ] P0.2.5 Criar testes de corrida `confirm vs expire`, `confirm vs fail`, `fail vs expire` e `public pay concorrente`.
  - Problema: o risco aparece sob concorrencia real.
  - Solucao: adicionar testes DB-backed ou smoke dedicado usando chamadas paralelas.
  - Validacao: testes provam uma unica transicao terminal e ledger/account/outbox coerentes.

Done Criteria:

- [ ] Cada transicao terminal tem lock ou update condicional.
- [ ] PixCharge nao permite dupla confirmacao efetiva.
- [ ] Ledger/account/outbox ficam coerentes em testes concorrentes.

### P0.3 Make PaymentLink create/cancel transactional

Status: `nao iniciado`

Problema: create salva `PixCharge` e `PaymentLink` fora de uma unica transacao; cancel tambem pode deixar link/charge em estado dividido ou competir com pay.

Impacto: falhas parciais podem criar PixCharge orfa ou estados divergentes entre link e charge; concorrencia com pay pode deixar resultado inconsistente.

Evidencia:

- `packages/core/src/application/use-cases/create-payment-link.use-case.ts`
- `packages/core/src/application/use-cases/cancel-payment-link.use-case.ts`
- `packages/core/src/domain/repositories/unit-of-work.interface.ts`

Subtasks:

- [ ] P0.3.1 Adicionar `paymentLinkRepository` ao conjunto de repositorios transacionados.
  - Problema: `UnitOfWork` nao expoe repositorio de PaymentLink para operacoes atomicas.
  - Solucao: adicionar interface e implementacao transacionada.
  - Validacao: teste de transactional repositories cobre `paymentLinkRepository`.
- [ ] P0.3.2 Criar lookup/update `PaymentLinkForUpdate` para cancel/pay.
  - Problema: cancel/pay precisam travar o link antes de mudar estado.
  - Solucao: adicionar metodo de repositorio que carrega link com lock na transacao.
  - Validacao: teste de repositorio valida query/semantica de lock.
- [ ] P0.3.3 Mover create de PixCharge + PaymentLink para `UnitOfWork`.
  - Problema: falha no save do link pode deixar PixCharge persistida.
  - Solucao: criar charge e link na mesma transacao.
  - Validacao: teste de rollback forca falha no link e verifica ausencia de PixCharge persistida.
- [ ] P0.3.4 Mover cancel de PaymentLink + PixCharge para `UnitOfWork`.
  - Problema: cancel pode atualizar uma entidade e falhar antes da outra.
  - Solucao: cancelar link e charge travados na mesma transacao.
  - Validacao: teste de rollback de cancel verifica estado original preservado.
- [ ] P0.3.5 Testar rollback de falha no save do link e corrida `cancel vs pay`.
  - Problema: consistencia precisa ser provada em falha e concorrencia.
  - Solucao: adicionar testes DB-backed para falha e chamadas paralelas.
  - Validacao: apenas um estado final coerente e sem registro orfao.

Done Criteria:

- [ ] Nenhum PixCharge orfao em falha de create.
- [ ] Cancel/pay concorrentes resultam em um unico estado final coerente.
- [ ] Testes de rollback e concorrencia cobrem o fluxo.

## P1 - Confiabilidade Operacional e Produto

### P1.1 Add worker readiness and smoke runner waits

Status: `nao iniciado`

Problema: worker tem listener HTTP, mas nao possui `/health/live` e `/health/ready`; `smoke:docker` espera API, mas nao prova readiness real do worker.

Impacto: smokes podem iniciar antes do worker estar pronto para DB/Redis/BullMQ, e operacao local nao tem endpoint claro para diagnosticar dependencias do worker.

Evidencia:

- `apps/worker/src/main.ts`
- `apps/worker/src/app.module.ts`
- `scripts/smoke-orchestrate-local.mjs`

Subtasks:

- [ ] P1.1.1 Criar health controller/module no worker.
  - Problema: worker nao tem endpoints de health.
  - Solucao: adicionar modulo/controller dedicado no app do worker.
  - Validacao: teste unitario cobre o controller.
- [ ] P1.1.2 `/health/live` deve retornar processo vivo.
  - Problema: nao ha liveness simples.
  - Solucao: endpoint publico retorna `{ status: "ok" }`.
  - Validacao: teste verifica status sem dependencias externas.
- [ ] P1.1.3 `/health/ready` deve checar Prisma e Redis/BullMQ connectivity.
  - Problema: readiness real depende de DB e Redis.
  - Solucao: pingar Prisma e Redis/BullMQ usados pelo worker.
  - Validacao: testes simulam sucesso e falha de dependencias.
- [ ] P1.1.4 Expor falha clara quando DB ou Redis estiver indisponivel.
  - Problema: erro generico dificulta diagnostico.
  - Solucao: resposta identifica dependencia falha.
  - Validacao: teste verifica payload/erro esperado.
- [ ] P1.1.5 Atualizar `smoke-orchestrate-local.mjs` para esperar worker ready.
  - Problema: runner espera API, mas nao worker.
  - Solucao: incluir wait HTTP para worker readiness antes das suites que dependem dele.
  - Validacao: smoke runner falha cedo se worker nao ficar ready.
- [ ] P1.1.6 Adicionar testes unitarios do health controller e validacao manual via smoke.
  - Problema: endpoint precisa ficar protegido contra regressao.
  - Solucao: cobrir controller/service e documentar comando manual.
  - Validacao: `pnpm --filter @hockpay/worker test` e smoke local focado.

Done Criteria:

- [ ] Worker ready falha sem DB/Redis.
- [ ] Smoke runner aguarda API e worker antes das suites.
- [ ] Logs de falha apontam dependencia indisponivel.

### P1.2 Add CI-safe checks and staged smoke gate

Status: `nao iniciado`

Problema: CI nao roda lint nem smokes; scripts `lint` de API/worker usam `--fix`, entao nao sao seguros para CI.

Impacto: regressao de estilo, worker, Redis, outbox e concorrencia pode chegar ao `main` sem gate automatico.

Evidencia:

- `.github/workflows/ci.yml`
- `package.json`
- `apps/api/package.json`
- `apps/worker/package.json`

Subtasks:

- [ ] P1.2.1 Adicionar `lint:check` nao mutante em API, worker e root.
  - Problema: `lint` atual pode reescrever arquivos.
  - Solucao: criar scripts sem `--fix`.
  - Validacao: rodar `pnpm run lint:check` e confirmar `git diff` vazio.
- [ ] P1.2.2 Adicionar `format:check` se o time quiser gate de formatacao.
  - Problema: `format` usa `--write` e nao serve para CI.
  - Solucao: adicionar `prettier --check`.
  - Validacao: comando falha em arquivo mal formatado sem reescrever.
- [ ] P1.2.3 Atualizar CI para rodar `pnpm run lint:check`.
  - Problema: CI nao executa lint.
  - Solucao: incluir step/job apos install/generate.
  - Validacao: workflow local/PR roda lint sem mutacao.
- [ ] P1.2.4 Planejar smoke CI minimo depois de readiness: iniciar com `p0,payment-link` ou job manual/nightly.
  - Problema: suite default e longa e depende de processos host.
  - Solucao: iniciar com escopo reduzido e modo manual/nightly ate endurecer runner.
  - Validacao: job executa e faz teardown.
- [ ] P1.2.5 Garantir teardown e upload/log de servicos quando smoke falhar.
  - Problema: falha de smoke sem logs e dificil de depurar.
  - Solucao: coletar logs de API/worker/checkout/containers como artifact.
  - Validacao: falha simulada gera artifacts.

Done Criteria:

- [ ] `pnpm run lint:check` nao altera `git diff`.
- [ ] CI falha em lint sem tentar corrigir arquivos.
- [ ] Smoke gate inicial tem escopo pequeno e logs suficientes.

### P1.3 Unify or validate Redis configuration

Status: `nao iniciado`

Problema: API usa `REDIS_URL` em idempotencia/cache, enquanto throttling, BullMQ e worker usam `REDIS_HOST`/`REDIS_PORT`; divergencia silenciosa quebra filas/idempotencia.

Impacto: API, worker e smokes podem apontar para Redis diferentes, causando cache/idempotencia/filas inconsistentes.

Evidencia:

- `apps/api/src/infra/services/idempotency-cache.service.ts`
- `apps/api/src/app.module.ts`
- `apps/worker/src/modules/queue/queue.module.ts`
- `docs/RUNBOOK.md`

Subtasks:

- [ ] P1.3.1 Criar helper compartilhado de parsing de Redis env.
  - Problema: parsing esta espalhado.
  - Solucao: criar helper reutilizavel por API e worker.
  - Validacao: testes unitarios do helper.
- [ ] P1.3.2 Aceitar URL-only, host/port-only e ambos consistentes.
  - Problema: configs validas precisam continuar ergonomicas.
  - Solucao: definir precedencia explicita e equivalencia.
  - Validacao: testes para cada combinacao valida.
- [ ] P1.3.3 Rejeitar configuracao conflitante com erro claro no startup.
  - Problema: divergencia silenciosa e perigosa.
  - Solucao: lançar erro com mensagem de conflito.
  - Validacao: teste de mismatch espera erro.
- [ ] P1.3.4 Aplicar helper em API idempotency, API throttling, worker queues e expiration queue.
  - Problema: cada ponto usa env diferente.
  - Solucao: substituir parsing direto pelo helper.
  - Validacao: testes de app/module ou unitarios dos providers.
- [ ] P1.3.5 Testar URL-only, host/port-only, matching e mismatch.
  - Problema: regressao de configuracao e facil.
  - Solucao: matriz de testes do helper e providers.
  - Validacao: suite focada passa.

Done Criteria:

- [ ] API e worker nao conseguem subir apontando para Redis divergente sem erro.
- [ ] Docs/runbook continuam alinhados com o contrato real.

### P1.4 Harden webhook SSRF beyond literal URL checks

Status: `nao iniciado`

Problema: policy bloqueia hosts literais privados/localhost, mas ainda ha divida para redirects, DNS rebinding/private resolution e fetch seguindo redirect.

Impacto: integracoes de webhook podem contornar a policy por redirect ou resolucao DNS para rede privada.

Evidencia:

- `packages/core/src/application/services/webhook-url-policy.service.ts`
- `packages/infrastructure/src/services/webhook-http-client.service.ts`

Subtasks:

- [ ] P1.4.1 Definir default seguro: local HTTP permitido apenas quando explicitamente habilitado.
  - Problema: local HTTP pode ser aceito por default incorreto em ambientes ambiguos.
  - Solucao: exigir opt-in explicito para destinos locais.
  - Validacao: teste com `NODE_ENV` unset rejeita localhost.
- [ ] P1.4.2 Impedir redirect automatico ou validar cada hop.
  - Problema: `fetch` pode seguir redirect para destino privado.
  - Solucao: usar redirect manual ou revalidar cada redirect antes de seguir.
  - Validacao: teste com redirect para metadata IP e localhost.
- [ ] P1.4.3 Resolver DNS no envio e bloquear IPs privados/reservados.
  - Problema: hostname publico pode resolver para IP privado.
  - Solucao: resolver DNS antes de conectar e bloquear faixas privadas/reservadas.
  - Validacao: teste com hostname mockado para `127.0.0.1`.
- [ ] P1.4.4 Adicionar testes para redirect para metadata IP, DNS para `127.0.0.1`, localhost com `NODE_ENV` unset e HTTPS publico valido.
  - Problema: seguranca depende de casos negativos claros.
  - Solucao: expandir spec do policy/client.
  - Validacao: suite de infrastructure/core passa.

Done Criteria:

- [ ] Webhook nao entrega para destinos privados via redirect/DNS.
- [ ] Destinos publicos HTTPS continuam funcionando.

### P1.5 Improve operational lists for Payments and Payment Links

Status: `nao iniciado`

Problema: Payments nao expoe filtros/paginacao no UI; Payment Links hard-code page 1/limit 50. Isso reduz investigacao operacional.

Impacto: merchants com mais volume perdem capacidade de localizar transacoes e links especificos no dashboard.

Evidencia:

- `apps/web/src/app/features/dashboard/pages/payments/payments.ts`
- `apps/web/src/app/core/services/payment.service.ts`
- `apps/web/src/app/features/dashboard/pages/payment-links/payment-links.ts`

Subtasks:

- [ ] P1.5.1 Adicionar estado URL-backed para status, busca, periodo, page e limit em Payments.
  - Problema: refresh/back/share perde contexto operacional.
  - Solucao: sincronizar filtros e paginacao com query params.
  - Validacao: teste cobre URL -> estado e estado -> URL.
- [ ] P1.5.2 Fazer `PaymentService.loadPayments(query)` receber os filtros reais.
  - Problema: UI chama refresh generico sem filtros.
  - Solucao: passar query completa para o service.
  - Validacao: teste do service/componente verifica parametros HTTP.
- [ ] P1.5.3 Adicionar paginacao e reset de page ao trocar filtros em Payment Links.
  - Problema: lista carrega page 1/limit 50 fixo.
  - Solucao: expor page/limit/totalPages e controles previous/next.
  - Validacao: teste cobre troca de filtro resetando page.
- [ ] P1.5.4 Renderizar empty/error states por filtro ativo.
  - Problema: vazio sem contexto parece falta de dados global.
  - Solucao: mensagens indicam filtro ativo e caminho para limpar.
  - Validacao: teste de empty state por filtro.
- [ ] P1.5.5 Testar query params, troca de filtro, next/previous e refresh mantendo estado.
  - Problema: comportamento operacional precisa sobreviver navegacao.
  - Solucao: specs de componente/roteador.
  - Validacao: testes focados web passam.

Done Criteria:

- [ ] Usuario consegue investigar pagamentos/links por status, busca e pagina.
- [ ] Refresh/back/share preserva a visao operacional.

### P1.6 Add refund initiation from Payment Detail

Status: `nao iniciado`

Problema: API de refund existe, mas dashboard so exibe refunds existentes; merchant nao consegue iniciar estorno pela UI.

Impacto: fluxo operacional de pos-venda fica incompleto e obriga uso de API/manual.

Evidencia:

- `apps/api/src/modules/refund/refund.controller.ts`
- `apps/api/src/modules/refund/dtos/create-refund.dto.ts`
- `apps/web/src/app/features/dashboard/pages/payment-detail/payment-detail.ts`

Subtasks:

- [ ] P1.6.1 Criar `RefundService` no web usando `POST /refunds`.
  - Problema: web nao tem adapter para iniciar refund.
  - Solucao: service com metodo create e headers de idempotencia.
  - Validacao: teste do service verifica endpoint e headers.
- [ ] P1.6.2 Adicionar drawer/dialog em Payment Detail com valor, motivo e confirmacao.
  - Problema: usuario nao tem UI de estorno.
  - Solucao: dialog consistente com dashboard, com campos obrigatorios.
  - Validacao: teste renderiza dialog e submit.
- [ ] P1.6.3 Gerar `Idempotency-Key` por submissao e impedir double submit.
  - Problema: refund e mutacao financeira sensivel.
  - Solucao: gerar chave por tentativa e bloquear botao durante request.
  - Validacao: teste de double click gera uma chamada.
- [ ] P1.6.4 Validar valor maximo restante reembolsavel.
  - Problema: UI pode permitir valor maior que restante.
  - Solucao: calcular restante por `amount - totalRefunded`.
  - Validacao: teste rejeita valor invalido antes da API.
- [ ] P1.6.5 Recarregar timeline, payment detail e financials impactados.
  - Problema: sucesso precisa refletir no diagnostico operacional.
  - Solucao: recarregar dados relevantes apos create.
  - Validacao: teste verifica chamadas de reload.
- [ ] P1.6.6 Testar valor invalido, sucesso, erro e refresh da timeline.
  - Problema: fluxo tem varios estados.
  - Solucao: specs cobrindo happy path e erros.
  - Validacao: testes focados passam.

Done Criteria:

- [ ] Refund parcial/total pode ser iniciado no dashboard.
- [ ] UI nao permite estornar mais que o saldo restante do payment.
- [ ] Timeline reflete o estorno apos sucesso.

## P2 - Acabamento, Acessibilidade e Docs Drift

### P2.1 Fix overview right-rail layout without losing equal-height intent

Status: `em implementacao`

Problema: diff atual corrige overflow visual, mas remove equal-height da coluna direita. O objetivo correto e manter cards alinhados sem deixar barra vazar.

Impacto: o dashboard overview fica visualmente inconsistente ou quebrado em desktop, especialmente nos cards Links/Pagamentos.

Evidencia:

- `apps/web/src/app/features/dashboard/pages/overview/overview.html`

Subtasks:

- [ ] P2.1.1 Redefinir comportamento desejado: no desktop, right rail alinha com chart; cards nao comprimem conteudo.
  - Problema: a correcao parcial removeu a intencao de alinhamento.
  - Solucao: registrar comportamento esperado antes de ajustar classes.
  - Validacao: comparacao visual desktop/mobile.
- [ ] P2.1.2 Ajustar layout com altura minima/conteudo natural e overflow interno controlado.
  - Problema: `flex-1`/`min-h-0` espremia conteudo; remover tudo desalinha.
  - Solucao: usar min-height/conteudo natural sem vazamento.
  - Validacao: card Links nao vaza barra.
- [ ] P2.1.3 Padronizar espessura das barras de Links e Pagamentos.
  - Problema: barras tinham alturas diferentes.
  - Solucao: usar mesma altura visual.
  - Validacao: inspecao visual e diff de classes.
- [ ] P2.1.4 Validar visualmente em desktop wide, laptop e mobile.
  - Problema: bug aparece por viewport.
  - Solucao: QA em larguras representativas.
  - Validacao: screenshots ou notas manuais no item.
- [ ] P2.1.5 Rodar build/teste web quando permissao de dist/cache permitir.
  - Problema: build pode falhar por permissao de dist, mas template precisa validar.
  - Solucao: rodar build/teste ou registrar bloqueio exato.
  - Validacao: build/teste passa ou bloqueio documentado.

Done Criteria:

- [ ] Card Links nao quebra nem vaza barra.
- [ ] Card Pagamentos usa barra consistente.
- [ ] Layout desktop nao fica visualmente desalinhado sem necessidade.

### P2.2 Add confirmations and accessible controls for destructive/admin actions

Status: `nao iniciado`

Problema: cancel/archive/test actions executam direto ou dependem de controles pouco acessiveis.

Impacto: usuario pode cancelar link ou arquivar produto sem confirmacao; controles importantes podem ser ruins para teclado/leitor de tela.

Evidencia:

- `apps/web/src/app/features/dashboard/pages/payment-links/payment-links.html`
- `apps/web/src/app/features/dashboard/pages/payment-link-detail/payment-link-detail.ts`
- `apps/web/src/app/features/dashboard/pages/products/products.ts`
- `apps/web/src/app/features/dashboard/pages/webhooks/webhooks.html`

Subtasks:

- [ ] P2.2.1 Adicionar confirmation dialog para cancel de Payment Link.
  - Problema: cancelamento executa imediatamente.
  - Solucao: dialog de confirmacao antes da chamada API.
  - Validacao: teste garante API nao chamada antes de confirmar.
- [ ] P2.2.2 Adicionar confirmation dialog para archive de Product.
  - Problema: arquivamento executa imediatamente.
  - Solucao: dialog de confirmacao.
  - Validacao: teste garante API nao chamada antes de confirmar.
- [ ] P2.2.3 Adicionar caminho para filtrar/ver inativos e reativar produto, se backend ja suportar.
  - Problema: UI torna archive quase one-way.
  - Solucao: filtro de ativos/inativos e acao de reativar quando aplicavel.
  - Validacao: teste de listar inativos e update `isActive=true`.
- [ ] P2.2.4 Trocar labels clicaveis de webhook events por inputs checkbox reais com `id/for`.
  - Problema: selecao de eventos e pouco acessivel.
  - Solucao: usar checkbox real com label associado.
  - Validacao: teste de teclado/click no label.
- [ ] P2.2.5 Adicionar `aria-label` em botoes icon-only.
  - Problema: botoes so com icone/titulo podem ser ambiguos.
  - Solucao: aplicar `aria-label` nos botoes de acao.
  - Validacao: teste/inspecao DOM.
- [ ] P2.2.6 Testar que API nao e chamada antes de confirmar.
  - Problema: regressao de confirmacao e facil.
  - Solucao: specs focadas para cancel/archive.
  - Validacao: mocks de service nao chamados antes do confirm.

Done Criteria:

- [ ] Acoes destrutivas exigem confirmacao.
- [ ] Controles chave funcionam por teclado e leitor de tela.

### P2.3 Respect checkout action flags and remove native alerts/confirms

Status: `nao iniciado`

Problema: checkout publico ignora `actions.canPay/canFail` e ainda usa `alert`; dashboard/checkout usam `window.confirm` em alguns fluxos.

Impacto: UI oferece acoes que backend considera indisponiveis e quebra consistencia visual/operacional com dialogs nativos.

Evidencia:

- `apps/checkout/src/types/checkout.ts`
- `apps/checkout/src/components/checkout/PaymentLinkPage.tsx`
- `apps/checkout/src/components/checkout/CheckoutPage.tsx`
- `apps/web/src/app/features/dashboard/pages/withdrawals/withdrawals.ts`
- `apps/web/src/app/features/dashboard/pages/withdrawal-detail/withdrawal-detail.ts`

Subtasks:

- [ ] P2.3.1 Usar `actions.canPay` e `actions.canFail` para habilitar/esconder simulacoes.
  - Problema: flags de backend sao ignoradas.
  - Solucao: condicionar botoes de simulacao as flags.
  - Validacao: teste com flags falsas.
- [ ] P2.3.2 Substituir `alert` por erro inline no checkout.
  - Problema: alert nativo interrompe fluxo e nao segue UI.
  - Solucao: estado de erro renderizado no componente.
  - Validacao: teste garante que erro aparece sem `window.alert`.
- [ ] P2.3.3 Substituir `window.confirm` por dialog/sheet no dashboard.
  - Problema: confirm nativo aparece em withdrawals e detalhes.
  - Solucao: usar componente de dialog do app.
  - Validacao: teste de confirmacao customizada.
- [ ] P2.3.4 Testar flags desabilitadas, erro de simulacao e ausencia de native alert path.
  - Problema: precisa evitar retorno de alerts.
  - Solucao: specs com spies em `window.alert`/`window.confirm`.
  - Validacao: spies nao chamados nos fluxos principais.

Done Criteria:

- [ ] A UI nao oferece acao que backend declarou indisponivel.
- [ ] Nenhum fluxo principal depende de alert/confirm nativo.

### P2.4 Make demo Media Kit mobile-safe

Status: `nao iniciado`

Problema: demo usa grids fixos que comprimem em telas pequenas.

Impacto: o study-case que demonstra o produto pode quebrar em mobile, reduzindo confianca no fluxo end-to-end.

Evidencia:

- `apps/demo-mediakit/app/page.tsx`
- `apps/demo-mediakit/components/mediakit-form.tsx`
- `apps/demo-mediakit/components/mediakit-render.tsx`

Subtasks:

- [ ] P2.4.1 Converter grids fixos para `grid-cols-1 sm:*`.
  - Problema: colunas fixas espremem conteudo.
  - Solucao: usar breakpoints responsivos.
  - Validacao: viewport 375px sem overflow horizontal.
- [ ] P2.4.2 Ajustar header, padding e tipografia mobile.
  - Problema: espacamento/tipo desktop pode quebrar mobile.
  - Solucao: classes responsivas de padding/tamanho.
  - Validacao: inspecao mobile e desktop.
- [ ] P2.4.3 Validar viewports 375px, tablet e desktop.
  - Problema: responsividade precisa ser comprovada.
  - Solucao: QA visual em tres larguras.
  - Validacao: screenshots ou notas manuais.
- [ ] P2.4.4 Adicionar screenshot/manual QA notes no item.
  - Problema: resultado visual precisa ficar rastreavel.
  - Solucao: registrar evidencia no tracker quando executado.
  - Validacao: item atualizado com notas.

Done Criteria:

- [ ] Demo nao tem overflow horizontal ou cards espremidos no mobile.
- [ ] Fluxo de form, checkout redirect e sucesso continua legivel.

### P2.5 Reconcile supporting docs with canonical product truth

Status: `nao iniciado`

Problema: READMEs de pacote/app divergem de `docs/CURRENT_STATE.md`, especialmente Products/Payment Links/ProductItem.

Impacto: mantenedores e integradores podem tratar funcionalidades implementadas como parciais ou inferir suporte inexistente de Products em Payment Links.

Evidencia:

- `apps/api/README.md`
- `packages/database/README.md`
- `packages/core/README.md`
- `docs/CURRENT_STATE.md`

Subtasks:

- [ ] P2.5.1 Corrigir `apps/api/README.md`: Products sao catalogo para checkout sessions; Payment Links sao amount-only.
  - Problema: README sugere Products para Payment Links.
  - Solucao: reword da tabela/modulos e observacoes.
  - Validacao: `rg` nao encontra wording contraditorio.
- [ ] P2.5.2 Corrigir `packages/database/README.md`: Product/PaymentItem nao sao mais apenas parciais no runtime.
  - Problema: doc de database esta atrasado em relacao ao runtime.
  - Solucao: descrever suporte implementado e limites futuros.
  - Validacao: README alinha com `docs/DATA_MODEL.md`.
- [ ] P2.5.3 Corrigir `packages/core/README.md`: Product/PaymentItem fazem parte do core atual.
  - Problema: README diz que nao fazem parte do slice consolidado.
  - Solucao: atualizar inventario e limites.
  - Validacao: README cita entidades/use cases atuais corretamente.
- [ ] P2.5.4 Corrigir docs do anti-fraud job como stub/simulado ou criar item futuro separado.
  - Problema: docs podem superestimar maturidade do job.
  - Solucao: marcar como stub/simulado se runtime nao escaneia de fato.
  - Validacao: docs nao prometem deteccao real.
- [ ] P2.5.5 Adicionar matriz compacta feature -> controller/schema/dashboard/smoke/limites.
  - Problema: maturidade fica espalhada.
  - Solucao: matriz pequena no tracker ou doc canonico apropriado.
  - Validacao: matriz referencia as features principais sem contradizer `CURRENT_STATE`.

Done Criteria:

- [ ] Supporting docs nao contradizem docs canonicos.
- [ ] Products/catalog e Payment Links ficam descritos com limites corretos.

## Public APIs / Interfaces Mentioned By The Tracker

- Payment Link public simulation endpoints devem ser documentados como TEST/dev-only e protegidos no backend.
- Redis config deve ganhar contrato unico ou validacao de conflito entre `REDIS_URL` e `REDIS_HOST`/`REDIS_PORT`.
- Worker deve ganhar `/health/live` e `/health/ready`.
- UI de Payments/Payment Links deve preservar estado via URL query.
- Refund UI deve usar endpoint existente de refunds com `Idempotency-Key`.

## Validation Plan For Creating The Tracker

- [ ] Criar apenas `CURRENT_WORKING_ITEMS.md` na raiz.
- [ ] Nao alterar codigo nesta etapa.
- [ ] Rodar `git diff --check -- CURRENT_WORKING_ITEMS.md`.
- [ ] Conferir com `rg -n "P0.1|P1.1|P2.5" CURRENT_WORKING_ITEMS.md`.
- [ ] Conferir `git status --short` para garantir que apenas o arquivo novo foi adicionado, alem do diff preexistente de overview.

## Assumptions

- Caminho escolhido: `/CURRENT_WORKING_ITEMS.md`, nao `docs/CURRENT_WORKING_ITEMS.md`.
- Escopo escolhido: somente P0-P2 validados.
- Ordenacao escolhida: risco primeiro.
- O diff atual de overview entra como `P2.1` e nao deve ser ignorado.
- Itens P3/futuro, como Settings mutavel, marketplace/split e simuladores nao-Pix, ficam fora desta primeira versao.
