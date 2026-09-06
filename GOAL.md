# Hockpay - Goal

Source repo: `/Users/jpcass/Documents/2026/hockpay`
Last reviewed: `2026-09-06`
Ordering: decisao antes de codigo; separar o gate existente antes de criar o novo
Scope: fatia 3 da superficie de operador -- habilitacao de loja para LIVE, o primeiro poder da mesa, e a simulacao em LIVE que a aprovacao destrava
Status: `em planejamento`

Este arquivo e o tracker executavel da goal atual. Cada macro item e uma unidade de planejamento; as checkboxes em `Subtasks` sao as unidades executaveis de implementacao e validacao.

A passagem anterior (arquivada em `docs/goals/2026-09-06-operator-boundary-and-environment-ledger.md`) fechou as fatias 1 e 2 do [PRD da superficie de operador](docs/PRD_OPERATOR_SURFACE.md): existe um principal `Operator` com trilha de auditoria append-only, e o ledger e separado por ambiente. Nenhuma das duas produziu tela ou poder -- elas existem para que esta fatia nao seja construida errada.

## Status Legend

- `nao iniciado`
- `em planejamento`
- `em implementacao`
- `em validacao/hardening`
- `concluido`

## Priority Legend

- `P0`: decisao estrutural cara de reverter, ou regra que separa TEST de LIVE.
- `P1`: poder da mesa, trilha do poder, e o que o produto precisa dizer em tela.
- `P2`: acabamento de doc e exemplo que nao muda invariante.

## Intake Snapshot

- Branch: `main` em `d883337` (PR #10 mergeado).
- Decidido em `2026-09-06`: **opcao B** para entrada de dinheiro em LIVE (registrada em `docs/PRD_ENVIRONMENT_LEDGER.md`). Simulacao tambem em LIVE, liberada so para loja aprovada. Por isso esta fatia nao e so "aprovar loja".
- Estados previstos pelo PRD pai: `NOT_REQUESTED`, `PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED`. TEST funciona em todos.
- O PRD desta fatia **ainda nao existe**. O primeiro item da goal e escreve-lo.

## P0 - Separar "loja ativa" de "loja habilitada para LIVE"

Status: `nao iniciado`

Problema: `Store.isApproved` nao significa "habilitada para producao". Ele bloqueia `create-payment`, `create-checkout-session`, `create-payment-link`, `create-withdrawal` e `switch-store` em **qualquer** ambiente, e nasce `true` com o comentario `// Auto-approve for MVP` em `create-store.use-case.ts`.

Impacto: reaproveitar essa flag como estado de habilitacao LIVE quebraria a promessa central do produto -- cobrar em TEST no minuto zero. As duas coisas sao diferentes e precisam de campos diferentes.

Evidencia:

- `packages/core/src/application/use-cases/create-store.use-case.ts` (`isApproved: true, // Auto-approve for MVP`)
- `create-payment.use-case.ts`, `create-checkout-session.use-case.ts`, `create-payment-link.use-case.ts`, `create-withdrawal.use-case.ts`, `switch-store.use-case.ts` (todos `if (!store.isApproved)`)
- `docs/PRD_OPERATOR_SURFACE.md`, secao "Onboarding: TEST livre, LIVE pela mesa"

Subtasks:

- [ ] P0.1 Escrever o PRD da fatia (`docs/PRD_LIVE_ONBOARDING.md`), decidindo: o que `isApproved` passa a significar, qual campo carrega a habilitacao LIVE, e o que acontece com as cinco chamadas que hoje dependem dele.
- [ ] P0.2 Modelar o estado de habilitacao no schema, com migration que nao muda o comportamento de nenhuma loja existente em TEST.
- [ ] P0.3 Cobrar em LIVE passa a exigir habilitacao; recusa e erro de dominio com code, nunca 500.

Done Criteria:

- [ ] Loja recem-criada cobra em TEST sem passar por aprovacao nenhuma.
- [ ] Loja sem habilitacao LIVE nao cobra em LIVE, e a recusa tem code no catalogo.
- [ ] Nenhuma loja existente perde acesso a TEST por causa da migration.

## P0 - Destravar a simulacao em LIVE para loja habilitada

Status: `nao iniciado`

Problema: hoje todo caminho que credita conta recusa LIVE (`/dev/simulate` rejeita key LIVE; `pay-payment-link` e `simulate-checkout-payment` recusam LIVE no use case). Sem mexer nisso, aprovar uma loja para LIVE nao produz efeito observavel nenhum -- o ledger LIVE existe e continua vazio.

Impacto: e o que separa a opcao B de uma cerimonia decorativa.

Subtasks:

- [ ] P0.4 Trocar os gates de "LIVE nunca" para "LIVE se a loja estiver habilitada".
- [ ] P0.5 Provar por teste que loja nao habilitada continua recusada em LIVE, e que loja habilitada credita **o ledger LIVE** e nao o TEST.

Done Criteria:

- [ ] Uma loja habilitada consegue cobrar, confirmar e acumular saldo em LIVE.
- [ ] O saldo LIVE nunca aparece no ledger TEST, e vice-versa.

## P1 - O primeiro poder da mesa, com rastro

Status: `nao iniciado`

Problema: aprovar e rejeitar habilitacao e o primeiro poder de verdade do operador. A trilha da fatia 1 hoje so registra login e logout.

Subtasks:

- [ ] P1.1 Rotas de operador para listar pedidos e decidir (aprovar/rejeitar/suspender), com `reason` **obrigatorio** na decisao.
- [ ] P1.2 Cada decisao grava linha na trilha com estado antes e depois, na mesma transacao da mudanca.
- [ ] P1.3 Lojista pede habilitacao (`NOT_REQUESTED -> PENDING`) e ve o estado.

Done Criteria:

- [ ] Nao existe mudanca de habilitacao sem linha correspondente na trilha.
- [ ] Decisao sem motivo e recusada pelo use case, nao pela tela.

## P1 - A tela nao pode mentir sobre LIVE

Status: `nao iniciado`

Problema: com a opcao B, LIVE tambem e simulado. Um LIVE que se apresenta como dinheiro real transforma o simulador em mentira.

Subtasks:

- [ ] P1.4 Dashboard diz, onde o ambiente aparece, que LIVE tambem e simulacao.
- [ ] P1.5 `CURRENT_STATE.md` e `PRODUCT.md` descrevem a habilitacao e o que ela destrava.

## Public APIs / Interfaces Mentioned By This Goal

- Novo estado de habilitacao LIVE em `Store` (campo a definir no PRD).
- Rotas de operador para a fila de habilitacao e para a decisao.
- Rota de merchant para pedir habilitacao.
- Gates de LIVE em `/dev/simulate`, `pay-payment-link` e `simulate-checkout-payment` passam a consultar habilitacao.

## Validation Log For This Goal

- [ ] `pnpm --filter @hockpay/core test:ci`
- [ ] `pnpm --filter @hockpay/infrastructure test`
- [ ] `pnpm --filter @hockpay/api test`
- [ ] `pnpm --filter @hockpay/api test:e2e`
- [ ] `pnpm --filter @hockpay/worker test`
- [ ] `pnpm --filter @hockpay/web test -- --watch=false`
- [ ] `pnpm run lint:check`, `pnpm run format:check`, `pnpm build`
- [ ] `smoke:docker` com `p0,withdrawals`

## Fora desta goal

- Condicao comercial (taxa e prazo) -- fatia 4.
- Visao cross-merchant para investigar chamado -- fatia 5.
- Antifraude como modulo -- fatia 6.
- Papeis dentro de `Operator`, impersonacao, MFA, retencao da trilha.
- Seletor de ambiente no dashboard, e saque/estorno em LIVE (o dashboard e TEST por sessao).
- Logout de merchant que nao revoga o refresh token no banco (achado da passagem anterior, sem correcao).
- KYC de verdade, chargeback, adquirencia real.

## Assumptions

- O PRD da fatia vem antes do codigo, como nas fatias 1 e 2. PRD e doc-only, entao vai direto na `main`; codigo vai por branch e PR.
- A opcao B esta decidida e nao sera reaberta nesta goal.
- A fatia 1 (fronteira e trilha) e a fatia 2 (ledger por ambiente) estao no runtime e nao precisam ser refeitas.

## Passagens anteriores

- `docs/goals/2026-08-18-architecture-hardening.md`
- `docs/goals/2026-08-18-workspace-honesty-and-integrity.md`
- `docs/goals/2026-08-19-leftover-authz-and-read-isolation.md`
- `docs/goals/2026-08-19-test-live-identity-isolation.md`
- `docs/goals/2026-09-06-operator-boundary-and-environment-ledger.md`
