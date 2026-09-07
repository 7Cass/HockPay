# Hockpay - Goal (arquivada)

Arquivada em `2026-09-07`. Nao ha goal ativa; a proxima esta em aberto em `/GOAL.md`.

Source repo: `/Users/jpcass/Documents/2026/hockpay`
Last reviewed: `2026-09-07`
Ordering: decisao antes de codigo; separar o gate existente antes de criar o novo
Scope: fatia 3 da superficie de operador -- habilitacao de loja para LIVE, o primeiro poder da mesa, e a simulacao em LIVE que a aprovacao destrava
Status final: `concluido`

Esta passagem fechou o passo 3 dos seis do [PRD da superficie de operador](../PRD_OPERATOR_SURFACE.md). As duas anteriores nao produziram tela nem poder -- existiam para que esta nao fosse construida errada. Esta e a primeira que aparece: uma loja pode ser habilitada para LIVE, e a habilitacao tem consequencia observavel.

## O que entrou

| PR/commit | Entrega                                                                        |
| --------- | ------------------------------------------------------------------------------ |
| `cc5750f` | [PRD da fatia 3](../PRD_LIVE_ONBOARDING.md) -- doc-only, direto na `main`      |
| #11       | Os tres commits abaixo, mergeado em `ceae2d1`                                  |
| `86eae44` | `isApproved` sai; `Store.liveStatus` entra; gate de criacao em LIVE            |
| `f5dccd6` | Pedido do lojista, fila e decisao da mesa, com trilha                          |
| `dc34acc` | Simulacao em LIVE destravada, tela e docs                                      |

Cada commit deixa a `main` num estado inteiro: o primeiro termina com LIVE fechado para todas as lojas, que era o comportamento de entao.

## Decisoes que valem para as proximas fatias

- **`isApproved` foi removido, nao reaproveitado.** Nascia `true` com `// Auto-approve for MVP`, nunca teve caminho de escrita, e os cinco gates que o consultavam duplicavam `isActive`. Mante-lo como kill-switch deixaria um campo permanentemente `true` chamado `isApproved` ao lado de `liveStatus: APPROVED`, e a proxima pessoa que precisasse de um gate escolheria o errado. Um kill-switch que ninguem aciona nao e capacidade, e nome reservado.
- **Uma regra so para LIVE, com uma excecao explicita.** Operacao LIVE iniciada pelo chamador exige `liveStatus === APPROVED` -- criar cobranca e simular. Os caminhos do proprio sistema (`SettlementJob`, fila e job de expiracao) passam `systemInitiated: true` e nao consultam habilitacao: bloquea-los prenderia dinheiro LIVE em `pending` para sempre quando a mesa suspende uma loja.
- **Transicoes moram na entidade.** `requestLive`, `approveLive`, `rejectLive` e `suspendLive` em `Store`, nao numa tabela de transicoes em algum service. Nao existe caminho para um estado que nao passe pela regra.
- **`reason` e regra de use case, nao de DTO.** Um cliente HTTP direto nao passa pela tela. O `class-validator` valida forma; a obrigatoriedade e checada no `DecideLiveEnablementUseCase`.
- **O pedido do lojista nao entra na trilha do operador.** `OperatorAuditLog.operatorId` e obrigatorio, e nao existe operador num pedido de merchant. Um id sintetico transformaria a trilha da mesa numa timeline de qualquer um. O pedido fica registrado em `Store.liveStatusChangedAt`.
- **A fila da mesa le o minimo.** `GET /operator/stores` devolve id, merchant, nome, slug, estado, razao e datas. Sem ledger, sem pagamento, sem secret de webhook e sem chave de API -- leitura cross-merchant e a fatia 5, e o PRD pai proibe operador ver credencial.

## Achados que mudaram o plano

- **Abrir o `dev.controller` para key LIVE, sozinho, abriria um buraco de isolamento.** Uma key TEST poderia confirmar um pagamento LIVE da mesma loja: `findByIdAndStoreIdForUpdate` nao filtra ambiente, e a recusa de LIVE na porta do controller era a unica coisa segurando isso. Duas coisas diferentes tinham virado uma so, e foram separadas: ambiente do chamador diferente do agregado e `LIVE_ENVIRONMENT_NOT_ALLOWED`; falta de habilitacao e `STORE_LIVE_NOT_ENABLED`. O chamador passou a se identificar (`callerEnvironment`, obrigatorio em confirm e fail) e o guard falha fechado se ele nao vier.
- **`allowLiveEnvironment` nunca significou "pode LIVE".** Significava "este e um caminho do proprio sistema". Com LIVE deixando de ser proibido, o nome passaria a enganar exatamente onde a decisao mais sutil da fatia mora -- virou `systemInitiated`.
- **`financials.html` mentia desde a fatia 2.** Dizia *"A conta da loja inteira. TEST e LIVE dividem o mesmo saldo."* Os saldos foram separados na passagem anterior e a tela nunca foi corrigida. Foi encontrada ao levantar o inventario do PRD, nao por teste -- nenhum teste cobre texto de tela.
- **O gate de LIVE em `simulate-checkout-payment` era duplicado.** O use case delegado ja recusa dentro da propria transacao. Dois gates para uma regra e um gate a mais; o de cima saiu.

## Achado de processo

**`pnpm run format` reformata o repositorio inteiro.** Rodado uma vez no meio da passagem, tocou 413 arquivos sem relacao nenhuma com o trabalho -- `apps/web/libs/ui/**`, checkout, demo-mediakit, READMEs, `tsconfig.json`, `turbo.json` e seis docs. `format:check` (o gate de CI) cobre um subconjunto menor, entao o churn passaria despercebido no gate e apareceria todo no diff do PR. Foi revertido arquivo a arquivo e a formatacao refeita so nos pacotes tocados. **Nas proximas passagens: formatar por pacote (`pnpm --filter <pkg> exec prettier --write`), nunca `pnpm run format` na raiz.**

## Validation Log

- [x] `pnpm --filter @hockpay/core test:ci` (291)
- [x] `pnpm --filter @hockpay/infrastructure test` (79)
- [x] `pnpm --filter @hockpay/api test` (169)
- [x] `pnpm --filter @hockpay/api test:e2e` (22)
- [x] `pnpm --filter @hockpay/worker test` (33)
- [x] `pnpm --filter @hockpay/web test -- --watch=false` (68)
- [x] `pnpm run lint:check`, `pnpm run format:check`, `pnpm build`
- [x] `smoke:docker` completo -- as seis suites `ok: true`, exit 0
- [x] Migration aplicada no Postgres de dev: 13 lojas em `NOT_REQUESTED`, todas ativas, ledger TEST intacto em 234244 e LIVE zerado
- [x] Ciclo `NOT_REQUESTED -> PENDING -> APPROVED -> SUSPENDED` rodado contra o Postgres de dev com os repositorios reais, cobrindo o SQL bruto de `findByIdForUpdate` e o `listByLiveStatus` que os unit tests mockam. Loja de teste apagada no fim; banco voltou ao estado anterior.

Os testes que carregam a regra: 30 casos rodam cada caminho de criacao nos cinco estados em TEST (todos passam) e em LIVE (so `APPROVED` passa) -- testar so a recusa deixaria passar um gate que tambem fecha TEST, que e o bug caro. Os testes de LIVE leem **as duas contas** depois de cada operacao.

## Dividas que esta passagem criou

- **Saque e estorno em LIVE.** Continuam JWT-only, e a sessao JWT e TEST. Enquanto LIVE estava vazio isso era "porta para uma sala vazia" (D6 do PRD do ledger); agora que o ledger LIVE enche, virou lacuna de produto. Depende do seletor de ambiente no dashboard.
- **A mesa e so API.** Nenhuma tela de operador em `apps/web`, mesmo padrao da fatia 1.

## Fora desta passagem

- Condicao comercial (taxa e prazo) -- fatia 4.
- Visao cross-merchant para investigar chamado -- fatia 5.
- Antifraude como modulo -- fatia 6.
- Papeis dentro de `Operator`, impersonacao, MFA, retencao/purga da trilha.
- Seletor de ambiente no dashboard, e saque/estorno em LIVE.
- Logout de merchant que nao revoga o refresh token no banco (achado da passagem anterior, ainda sem correcao).
- KYC de verdade, chargeback, adquirencia real.
