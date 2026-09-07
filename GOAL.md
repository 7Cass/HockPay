# Hockpay - Goal

Source repo: `/Users/jpcass/Documents/2026/hockpay`
Last reviewed: `2026-09-07`
Ordering: PRD antes de codigo; conteudo antes de tela; a mesa antes do dashboard
Scope: tudo que a fatia 3 deixou operavel apenas por `curl` -- a segunda decisao da mesa, a leitura para investigar, a tela que torna as tres operaveis, e o ambiente LIVE que o lojista ainda nao ve
Status: `em planejamento`

Este arquivo e o tracker executavel da goal atual. Cada macro item e uma unidade de planejamento; as checkboxes em `Subtasks` sao as unidades executaveis de implementacao e validacao.

A passagem anterior (arquivada em `docs/goals/2026-09-07-live-onboarding.md`) fechou a fatia 3: existe habilitacao LIVE por loja, a mesa decide com motivo e rastro, e loja aprovada acumula saldo no ledger LIVE. Ela deixou uma capacidade que **ninguem consegue ver nem operar**: a mesa e `curl`, e o saldo LIVE so existe por API. Esta goal fecha isso.

## Status Legend

- `nao iniciado`
- `em planejamento`
- `em implementacao`
- `em validacao/hardening`
- `concluido`

## Priority Legend

- `P0`: poder novo da mesa, ou decisao estrutural cara de reverter.
- `P1`: a superficie que torna poder existente operavel.
- `P2`: acabamento de doc e exemplo que nao muda invariante.

## Intake Snapshot

- Branch: `main` em `33fa274` (PR #11 mergeado em `ceae2d1`).
- Tres das seis fatias do [PRD pai](docs/PRD_OPERATOR_SURFACE.md) estao no runtime. Faltam a 4 (condicao comercial), a 5 (leitura cross-merchant) e a 6 (antifraude).
- A fatia 6 **fica fora**: o PRD pai e explicito que o motor entra depois da fila de revisao existir, e ela nao existe.
- **Nenhuma das fatias desta goal tem PRD.** A convencao do projeto e PRD antes de codigo (fatias 1, 2 e 3 fizeram assim), e PRD e doc-only, entao vai direto na `main`.
- Levantamento feito em `2026-09-07`, antes de estimar:
  - `Store._feePercent`, `_feeFixed` e `_settlementDays` sao `private readonly` -- mesma forma que `liveStatus` tinha antes da fatia 3.
  - `request.environment = Environment.TEST` esta **hardcoded** em `combined-auth.guard.ts:86`; a `JwtStrategy` nem seta o campo, quem cobre e o `?? Environment.TEST` do decorator. 14 arquivos consomem `CurrentEnvironment`.
  - `switch-store.use-case.ts:76` ja re-emite o access token ao trocar contexto de sessao -- precedente direto para trocar de ambiente.
  - As leituras que a fatia 5 precisa ja existem e sao store-scoped: `list-payments`, `get-account`, `list-transactions`, `get-payment-timeline`, `list-webhook-logs`, `list-webhook-configs`.
  - `WebhookConfig._secret` ja e guardado encriptado, com `prefix` para identificacao. A propriedade "operador nao le secret" e em boa parte estrutural; falta o teste que prova.

## P0 - Escrever os PRDs antes do codigo

Status: `nao iniciado`

Problema: tres entregas desta goal nao tem decisao registrada. Sem PRD, as perguntas caras (o que a mesa pode ler sem virar backdoor; onde o ambiente da sessao mora) seriam respondidas no meio da implementacao.

Impacto: as fatias 1, 2 e 3 mostraram que o PRD e o que evita reabrir decisao com codigo em cima. A fatia 3 so nao reaproveitou `isApproved` porque isso foi decidido antes de existir migration.

Subtasks:

- [ ] P0.1 `docs/PRD_OPERATOR_DESK.md` -- cobre condicao comercial, leitura cross-merchant e a tela numa passagem so. As tres respondem a mesma pergunta ("a mesa vira mesa") e separa-las em tres PRDs seria cerimonia.
- [ ] P0.2 `docs/PRD_ENVIRONMENT_SELECTOR.md` -- separado porque e outro principal e outra pergunta de produto: o que o lojista ve, e o que saque/estorno em LIVE passam a significar.

Done Criteria:

- [ ] Cada PRD decide, e nao so descreve: o que a mesa pode ler, onde o ambiente da sessao mora, e o que acontece com saque/estorno em LIVE.
- [ ] Os dois vao direto na `main`, doc-only.

## P0 - Condicao comercial, auditada (fatia 4)

Status: `nao iniciado`

Problema: `feePercent`, `feeFixed` e `settlementDays` nascem com default e nunca mudam -- nao existe caminho de escrita. O PRD pai lista "ajustar taxa e prazo" como poder da mesa.

Impacto: e a unica fatia restante que mexe em dinheiro do lojista. Sem ela, a mesa decide **quem** opera mas nao **sob que condicao**.

Evidencia:

- `packages/core/src/domain/entities/store.entity.ts` (os tres campos `private readonly`)
- `docs/PRD_OPERATOR_SURFACE.md`, secao "O que o operador pode" e "Nao muda taxa retroativamente"

Subtasks:

- [ ] P0.3 Os tres campos viram mutaveis na entidade, por metodo com regra -- nao por setter solto, como `liveStatus` fez.
- [ ] P0.4 `POST /operator/stores/:id/commercial-terms` com `reason` obrigatorio, validado no use case.
- [ ] P0.5 Acao nova na trilha, com `before`/`after` dos tres valores.

Done Criteria:

- [ ] Mudanca de taxa nao altera o `fee` de nenhum `Payment` ja gravado, provado por teste.
- [ ] Nao existe mudanca de condicao comercial sem linha correspondente na trilha.
- [ ] Valor fora de faixa e recusado pelo dominio, com code no catalogo.

## P0 - Leitura para investigar chamado (fatia 5)

Status: `nao iniciado`

Problema: o operador nao le dado de loja nenhuma. Investigar um chamado e impossivel pela superficie da mesa.

Impacto: e o poder que um operador real mais usa, e o unico que da conteudo de verdade para a tela.

Evidencia:

- As leituras ja existem e sao store-scoped (ver Intake Snapshot); o trabalho e expo-las por um caminho de operador sem alargar o que elas devolvem.
- `docs/PRD_OPERATOR_SURFACE.md`, "Nao le segredo": secret de webhook e chave de API continuam invisiveis, inclusive para operador.

Subtasks:

- [ ] P0.6 Rotas de operador para payments, ledger, transacoes, timeline e entregas de webhook de uma loja escolhida.
- [ ] P0.7 Teste de varredura que prova que nenhuma rota de leitura de operador devolve secret de webhook ou chave de API.
- [ ] P0.8 Decidir no PRD, e implementar, se leitura entra na trilha. Hoje ela so registra escrita.

Done Criteria:

- [ ] Operador investiga um pagamento de qualquer loja sem tocar em credencial.
- [ ] A varredura falha se uma rota futura devolver secret -- verificado por teste, nao por revisao.
- [ ] Nenhuma rota de leitura de operador aceita token de merchant, e vice-versa.

## P1 - A mesa ganha tela

Status: `nao iniciado`

Problema: a mesa tem fronteira, trilha e (depois dos itens acima) tres poderes, e nada disso tem tela. O PRD pai e explicito: "trilha que so existe no banco nao e trilha, e log".

Impacto: nenhuma capacidade nova. O que muda e que a superficie de operador passa a ser parte do que o simulador **ensina**, que e o argumento de produto que a justifica. Ninguem aprende o formato de decisao de um gateway por `curl`.

Evidencia:

- `apps/web` tem `auth.guard.ts`/`guest.guard.ts` e tres layouts, todos de merchant. Nao existe nada de operador.
- `docs/CURRENT_STATE.md`, Matriz de Superficies: "sem dashboard de operador".

Subtasks:

- [ ] P1.1 Sessao de operador em `apps/web`, com guard e layout proprios -- sem reusar o caminho de merchant.
- [ ] P1.2 Fila de habilitacao e decisao (aprovar/rejeitar/suspender) com motivo.
- [ ] P1.3 Condicao comercial editavel, com o antes e o depois visiveis.
- [ ] P1.4 Trilha legivel na propria superficie.
- [ ] P1.5 Investigacao de loja, usando as leituras do item anterior.

Done Criteria:

- [ ] Um operador opera a fila inteira, decide, ajusta condicao e le a trilha sem `curl`.
- [ ] Nenhuma tela de operador expoe secret de webhook ou chave de API.
- [ ] Sessao de merchant e de operador coexistem no mesmo browser sem se atrapalhar.

## P1 - O lojista enxerga o LIVE que a fatia 3 encheu

Status: `nao iniciado`

Problema: `request.environment` e TEST fixo para toda sessao JWT. O dashboard nao consegue mostrar LIVE porque a sessao nao sabe dizer outra coisa.

Impacto: e a divida que a fatia 3 criou. Aprovar uma loja para LIVE hoje produz um saldo que so aparece por API -- o oposto do que a fatia 3 existe para ensinar. E saque e estorno em LIVE seguem bloqueados por acidente de sessao, nao por decisao de produto.

Evidencia:

- `apps/api/src/modules/auth/guards/combined-auth.guard.ts:86` (`request.environment = Environment.TEST`)
- `apps/api/src/modules/auth/strategies/jwt.strategy.ts` (nao seta o campo)
- `docs/CURRENT_STATE.md`, Gaps: "Dashboard nao tem seletor TEST/LIVE"

Subtasks:

- [ ] P1.6 `environment` entra no `JwtPayload`; o guard le em vez de assumir.
- [ ] P1.7 Rota de troca de ambiente que re-emite o par de tokens, seguindo `switch-store`.
- [ ] P1.8 Seletor na tela, com LIVE marcado como simulado onde ele aparecer.
- [ ] P1.9 Saque e estorno em LIVE, conforme o PRD decidir.

Done Criteria:

- [ ] Dashboard em LIVE mostra o ledger LIVE e nunca mistura com o TEST, provado por teste que le os dois.
- [ ] Trocar de ambiente invalida a sessao anterior, como `switch-store` ja faz.
- [ ] Loja sem habilitacao LIVE nao consegue selecionar LIVE.

## P2 - Docs acompanham

Status: `nao iniciado`

Subtasks:

- [ ] P2.1 `CURRENT_STATE.md`: Matriz de Maturidade, Matriz de Superficies e a secao de isolamento TEST/LIVE.
- [ ] P2.2 `PRODUCT.md`: a jornada de operador, e o que o seletor de ambiente muda para o lojista.
- [ ] P2.3 Fechar no `CURRENT_STATE` os itens que deixam de ser gap.

## Public APIs / Interfaces Mentioned By This Goal

- `POST /operator/stores/:id/commercial-terms`
- Rotas de leitura de operador por loja (payments, ledger, transacoes, timeline, webhook logs)
- Rota de troca de ambiente para merchant
- `environment` no `JwtPayload`
- Acoes novas em `OPERATOR_AUDIT_ACTION`
- Rotas de `apps/web` sob a sessao de operador

## Validation Log For This Goal

- [ ] `pnpm --filter @hockpay/core test:ci`
- [ ] `pnpm --filter @hockpay/infrastructure test`
- [ ] `pnpm --filter @hockpay/api test`
- [ ] `pnpm --filter @hockpay/api test:e2e`
- [ ] `pnpm --filter @hockpay/worker test`
- [ ] `pnpm --filter @hockpay/web test -- --watch=false`
- [ ] `pnpm run lint:check`, `pnpm run format:check`, `pnpm build`
- [ ] `smoke:docker` completo
- [ ] Fluxo de operador exercitado na tela, ponta a ponta
- [ ] Dashboard em LIVE exercitado contra Postgres local, lendo os dois ledgers

## Fora desta goal

- **Antifraude como modulo (fatia 6).** O PRD pai e explicito: o motor entra depois da fila de revisao existir.
- Papeis dentro de `Operator`, impersonacao, MFA, retencao/purga da trilha.
- Logout de merchant que nao revoga o refresh token no banco (achado de `2026-09-06`, ainda sem correcao).
- KYC de verdade, chargeback, adquirencia real.

## Assumptions

- PRD antes de codigo, e PRD e doc-only, entao vai direto na `main`. Codigo vai por branch e PR.
- As fatias 1, 2 e 3 estao no runtime e nao serao refeitas.
- `Payment.fee` continua sendo snapshot no momento da cobranca; a condicao comercial vale so para o futuro.

## Riscos

| Risco                                                  | Como aparece                                          | O que segura                                                                 |
| ------------------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| A goal e grande demais para uma passagem               | Meses sem merge, e um PR gigante no fim               | Cada macro item e entregavel sozinho; ver "Onde cortar"                      |
| Rota de leitura de operador vazando secret             | Credencial exposta, sem erro visivel                  | Teste de varredura (P0.7), criterio de aceite e nao acabamento               |
| Tela de operador reusando a sessao de merchant         | Fronteira da fatia 1 dissolvida na camada de cima     | Guard e layout proprios (P1.1), e o teste de coexistencia das duas sessoes   |
| `environment` no token sem checar habilitacao          | Loja nao habilitada selecionando LIVE                 | Done criteria do ultimo macro item                                           |
| Formatar com `pnpm run format` na raiz                 | 413 arquivos de churn que o gate de CI nao pega       | Achado de `2026-09-07`: formatar por pacote                                  |

## Onde cortar, se a passagem ficar grande

A goal tem duas trilhas, e elas nao dependem uma da outra:

- **A mesa vira mesa:** condicao comercial, leitura cross-merchant e tela. Fecha o PRD pai menos a fatia 6.
- **O lojista enxerga LIVE:** seletor de ambiente. Fecha a divida da fatia 3.

Se for para cortar, corte por trilha inteira, nao pelo meio de uma. E dentro da primeira trilha a ordem importa: condicao comercial e leitura vem antes da tela, porque tela sem conteudo e a mesma capacidade fantasma que o projeto ja removeu uma vez.

## Passagens anteriores

- `docs/goals/2026-08-18-architecture-hardening.md`
- `docs/goals/2026-08-18-workspace-honesty-and-integrity.md`
- `docs/goals/2026-08-19-leftover-authz-and-read-isolation.md`
- `docs/goals/2026-08-19-test-live-identity-isolation.md`
- `docs/goals/2026-09-06-operator-boundary-and-environment-ledger.md`
- `docs/goals/2026-09-07-live-onboarding.md`
