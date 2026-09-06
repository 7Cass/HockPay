# PRD - Onboarding LIVE

> **Status: proposta. Nada descrito aqui existe no runtime.**
> Este documento detalha a **fatia 3** do
> [PRD - Superficie de operador](PRD_OPERATOR_SURFACE.md). Enquanto a Matriz de
> Maturidade do [CURRENT_STATE.md](CURRENT_STATE.md) nao registrar a mudanca,
> tudo abaixo e intencao.

Last reviewed: `2026-09-06`
Depende de: [fronteira de autorizacao](PRD_OPERATOR_AUTHZ.md) (fatia 1, implementada) e [ledger por ambiente](PRD_ENVIRONMENT_LEDGER.md) (fatia 2, implementada)

## O que esta fatia entrega

Tres coisas que so fazem sentido juntas:

1. **Um estado de habilitacao LIVE** em `Store`, separado de qualquer flag que
   ja exista. TEST continua funcionando em todos os estados.
2. **O primeiro poder da mesa**: aprovar, rejeitar e suspender essa habilitacao,
   com motivo obrigatorio e uma linha na trilha por decisao.
3. **A consequencia observavel**: a loja aprovada passa a simular em LIVE, e o
   ledger LIVE -- que a fatia 2 criou vazio -- comeca a encher.

O item 3 e o que separa esta fatia de uma cerimonia decorativa. Foi decidido em
`2026-09-06` como **opcao B** no
[PRD do ledger por ambiente](PRD_ENVIRONMENT_LEDGER.md#como-dinheiro-entra-em-live--decidido-em-2026-09-06),
e nao e reaberto aqui.

## O achado que define a ordem desta fatia

`Store.isApproved` **nao e um estado de aprovacao**. Ele nasce `true` com o
comentario `// Auto-approve for MVP` em `create-store.use-case.ts:81`, nao tem
nenhum caminho de escrita que o mude depois, e nenhuma loja jamais teve o valor
`false` fora de teste.

Os cinco gates que o consultam sao, na pratica, no-ops que duplicam `isActive`:

| Use case                          | Linha do gate |
| --------------------------------- | ------------- |
| `create-payment.use-case`         | `:136`        |
| `create-checkout-session.use-case`| `:59`         |
| `create-payment-link.use-case`    | `:80`         |
| `create-withdrawal.use-case`      | `:49`         |
| `switch-store.use-case`           | `:64`         |

E ha dois consumidores fora dos use cases, que tambem so leem `true`:
`StoreRepository.listActiveApproved()` (usado pelo `SettlementJob`) e a clausula
`AND s.is_approved = true` em `AccountRepository.findWithPendingBalance`.

Duas consequencias:

1. **Nao ha o que preservar.** A migration nao muda o comportamento de nenhuma
   loja, porque o campo nunca discriminou nenhuma.
2. **Reaproveitar o campo seria o erro caro.** Um `isApproved` que bloqueia os
   dois ambientes, transformado em habilitacao LIVE, quebraria a promessa
   central do produto -- cobrar em TEST no minuto zero.

## Estado atual que esta fatia toca

| Onde                                                                | Fato de hoje                                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `packages/database/prisma/schema.prisma`                            | `Store.isApproved Boolean @default(false)`; nenhum estado de habilitacao                          |
| `create-store.use-case.ts:81`                                       | `isApproved: true, // Auto-approve for MVP`                                                       |
| Os cinco use cases da tabela acima                                  | `if (!store.isApproved) throw new StoreNotApprovedError(...)`                                     |
| `StoreRepository`                                                   | `save`, `update` e `toDomain` carregam `isApproved`; `listActiveApproved()` filtra por ele        |
| `AccountRepository.findWithPendingBalance`                          | `AND s.is_approved = true` no SQL bruto                                                           |
| `apps/api/src/modules/payment/dev.controller.ts:157`                | `validateTestEnvironment` recusa key LIVE em confirm/expire/fail/release                          |
| `confirm-payment`, `expire-payment`, `fail-payment`                 | `assertNotLiveEnvironment(payment.environment)`                                                   |
| `release-payment.use-case.ts:60`                                    | `assertNotLiveEnvironment` **exceto** quando `allowLiveEnvironment: true` (so o `SettlementJob`)   |
| `pay-payment-link` e `fail-payment-link`                            | `ensureSimulationAllowed` recusa LIVE na request **e** no link                                    |
| `simulate-checkout-payment.use-case.ts:78`                          | recusa `payment.environment === LIVE`                                                             |
| `apps/api/src/common/constants/error-codes.ts`                      | `STORE_NOT_APPROVED: 422`, categoria `BUSINESS`                                                   |
| `apps/web/.../financials.html:4`                                    | `"A conta da loja inteira. TEST e LIVE dividem o mesmo saldo."` -- **mentira desde a fatia 2**     |
| `OPERATOR_AUDIT_ACTION`                                             | So `LOGIN` e `LOGOUT`                                                                             |

## Decisoes

### D1. `isApproved` sai do modelo

O campo, o `StoreNotApprovedError`, o code `STORE_NOT_APPROVED` e os campos
correspondentes nos DTOs de API e de `apps/web` sao removidos. Os cinco gates
ficam so com `isActive`. `listActiveApproved()` vira `listActive()`, e a
clausula `AND s.is_approved = true` sai do SQL de `findWithPendingBalance`.

A alternativa -- manter `isApproved` como um kill-switch store-wide -- foi
descartada. Ela deixaria um campo permanentemente `true` chamado `isApproved`
convivendo com `liveStatus: APPROVED`, e a proxima pessoa que precisar de um
gate vai escolher o errado. Um kill-switch que ninguem aciona nao e uma
capacidade, e um nome reservado.

`isActive` continua sendo o desligamento da loja, e continua sem caminho de
escrita. Isso nao piora nada: hoje `isApproved` tambem nao tem.

### D2. A habilitacao e um enum proprio em `Store`

```prisma
enum StoreLiveStatus {
  NOT_REQUESTED
  PENDING
  APPROVED
  REJECTED
  SUSPENDED
}

model Store {
  // ...
  liveStatus          StoreLiveStatus @default(NOT_REQUESTED) @map("live_status")
  liveStatusReason    String?         @map("live_status_reason")
  liveStatusChangedAt DateTime?       @map("live_status_changed_at")
}
```

Enum, e nao boolean, porque `PENDING` e `REJECTED` sao estados que o produto
precisa mostrar e que um boolean nao representa. Os cinco estados sao os do
[PRD pai](PRD_OPERATOR_SURFACE.md#onboarding-test-livre-live-pela-mesa), sem
invencao.

`liveStatusReason` e `liveStatusChangedAt` existem porque **o lojista precisa
ver por que foi recusado**, e a trilha de auditoria e legivel so pelo operador.
Sao a denormalizacao da ultima decisao, nao um historico: o historico e a
trilha, e ele nao e duplicado aqui.

### D3. A habilitacao e gate de LIVE, e de nada mais

Nenhum caminho TEST consulta `liveStatus`. Uma loja em `NOT_REQUESTED` cria
pagamento, link, checkout session, produto, saque e estorno em TEST exatamente
como hoje. Essa e a promessa do produto -- "reduzir o tempo ate o primeiro
pagamento" -- e ela nao e negociada por esta fatia.

### D4. Uma regra so: LIVE exige `APPROVED`

```
operacao LIVE iniciada pelo chamador  <=>  store.liveStatus === APPROVED
```

Vale para criar cobranca e para simular. Suspensao para o ambiente de verdade:
um `Payment` LIVE que ja estava `PENDING` numa loja suspensa nao confirma mais,
e segue ate `EXPIRED`.

A alternativa -- deixar liquidar o que estava em voo -- e mais fiel ao que um
gateway real faz, e foi descartada por custo de conceito: seriam duas regras
(criacao consulta habilitacao, simulacao nao) e o dobro de casos de teste, para
uma diferenca que um simulador nao precisa ensinar nesta fatia.

**A excecao, e o motivo dela:** o `SettlementJob` chama `release-payment` com
`allowLiveEnvironment: true`. Esse caminho **nao** passa a consultar
habilitacao. Ele nao e uma operacao do chamador -- e o relogio do sistema
movendo `pending` para `available` num pagamento que ja foi legitimamente
confirmado. Bloquea-lo deixaria dinheiro LIVE preso em `pending` para sempre,
que e pior do que qualquer coisa que a suspensao pretende evitar. A regra
completa, entao:

```
caminho iniciado pelo chamador  ->  exige APPROVED
caminho interno de liquidacao   ->  segue o ambiente do pagamento, como hoje
```

### D5. O gate mora no dominio, e os use cases de simulacao passam a ler a store

Entra um guard ao lado do que ja existe:

```ts
// packages/core/src/application/services/live-environment-guard.ts
export function assertLiveEnvironmentEnabled(store: Store, environment: Environment): void {
  if (environment === Environment.LIVE && !store.isLiveEnabled()) {
    throw new StoreLiveNotEnabledError(store.id);
  }
}
```

`Store.isLiveEnabled()` e `this._liveStatus === StoreLiveStatus.APPROVED`. A
regra fica na entidade, e nao espalhada em nove comparacoes de string.

Consequencia que vale dizer em voz alta: `confirm-payment`, `expire-payment`,
`fail-payment` e `release-payment` hoje decidem so com `payment.environment` e
passam a precisar da `Store`. Ganham uma leitura a mais dentro da transacao que
ja existe (`repos.storeRepository`, ja disponivel em `ITransactedRepositories`).
E o custo de a habilitacao ser um fato da loja e nao do pagamento.

`assertNotLiveEnvironment` sobrevive apenas onde LIVE continua fechado por
outros motivos (saque e estorno, ver Nao-objetivos). Onde ela vira
`assertLiveEnvironmentEnabled`, a chamada antiga e **removida**, nao mantida ao
lado: as duas juntas seriam um gate que recusa LIVE sempre, com um segundo gate
morto embaixo.

### D6. Decisao da mesa exige motivo, e a recusa vem do use case

`reason` e obrigatorio nas tres decisoes (aprovar, rejeitar, suspender), com
validacao de string nao-vazia **no use case**, nao no DTO. A tela nao e o lugar
onde uma regra de auditoria mora: um cliente HTTP direto nao passa pela tela.

O PRD da fatia 1 registrou que `reason` seria opcional na coluna ate existir um
poder com consequencia financeira. Este e esse poder: habilitar LIVE e o que
permite dinheiro entrar no ledger LIVE. A coluna continua opcional (login e
logout nao tem motivo); a obrigatoriedade e da acao.

### D7. Toda decisao grava a trilha, na mesma transacao

`OPERATOR_AUDIT_ACTION` ganha tres entradas:

```ts
STORE_LIVE_APPROVED:  'store.live_approved',
STORE_LIVE_REJECTED:  'store.live_rejected',
STORE_LIVE_SUSPENDED: 'store.live_suspended',
```

Cada linha carrega `targetType: 'store'`, `targetId: store.id`,
`before: { liveStatus }`, `after: { liveStatus }`, `reason` e `requestId`. A
escrita acontece dentro do mesmo `unitOfWork.execute` que muda a loja -- que e o
que a fatia 1 tornou estrutural ao deixar o repositorio da trilha alcancavel so
por `ITransactedRepositories`.

**O pedido do lojista nao entra na trilha.** `OperatorAuditLog.operatorId` e
obrigatorio, e nao existe operador num pedido de merchant. Forcar um id
sintetico ali transformaria a trilha da mesa numa timeline de qualquer um.
`liveStatusChangedAt` registra o pedido; se um dia houver historico de merchant,
ele e outro objeto.

### D8. Transicoes validas, e quem pode causar cada uma

| De              | Para        | Quem     |
| --------------- | ----------- | -------- |
| `NOT_REQUESTED` | `PENDING`   | Lojista  |
| `REJECTED`      | `PENDING`   | Lojista  |
| `PENDING`       | `APPROVED`  | Operador |
| `PENDING`       | `REJECTED`  | Operador |
| `APPROVED`      | `SUSPENDED` | Operador |
| `SUSPENDED`     | `APPROVED`  | Operador |

Qualquer outra transicao e recusada com
`INVALID_STORE_LIVE_STATUS_TRANSITION`. Em particular: o operador nao aprova uma
loja que nunca pediu (`NOT_REQUESTED -> APPROVED` nao existe), e o lojista nao
sai de `SUSPENDED` sozinho -- reabilitar e decisao da mesa, com motivo.

A validacao mora na entidade `Store` (`requestLive()`, `approveLive(reason)`,
`rejectLive(reason)`, `suspendLive(reason)`), nao numa tabela de transicoes em
algum service. Nenhum desses metodos permite chegar num estado sem passar pela
regra.

### D9. A tela nao pode dizer que LIVE e dinheiro

Com a opcao B, LIVE tambem e simulado. Onde o ambiente aparece no dashboard, a
tela diz isso. Nao e acabamento: um LIVE que se apresenta como dinheiro real
transforma o simulador numa mentira, e o projeto inteiro e construido no oposto.

E ha uma frase que ja esta errada desde a fatia 2 e sai junto:
`financials.html` diz *"A conta da loja inteira. TEST e LIVE dividem o mesmo
saldo."* -- os saldos foram separados na fatia 2 e a tela nunca foi corrigida.

## Superficie HTTP

### Operador

| Rota                                     | Auth     | O que faz                                                          |
| ---------------------------------------- | -------- | ------------------------------------------------------------------ |
| `GET /operator/stores`                   | operador | Fila de habilitacao. Filtro `liveStatus`, paginado, ordem decrescente |
| `POST /operator/stores/:id/live-status`  | operador | `{ decision: 'approve' \| 'reject' \| 'suspend', reason }`          |

`GET /operator/stores` devolve **so o que a decisao exige**: `id`, `name`,
`slug`, `merchantId`, `liveStatus`, `liveStatusReason`, `liveStatusChangedAt`,
`createdAt`. Sem ledger, sem pagamento, sem secret de webhook, sem chave de API
-- o PRD pai proibe, e leitura cross-merchant para investigar chamado e a fatia
5, nao esta.

### Merchant

| Rota                              | Auth | O que faz                                          |
| --------------------------------- | ---- | -------------------------------------------------- |
| `POST /stores/:id/live-request`   | JWT  | `NOT_REQUESTED \| REJECTED -> PENDING`             |
| `GET /stores`                     | JWT  | Passa a devolver `liveStatus` e a ultima razao     |

## Erros

Sai do catalogo: `STORE_NOT_APPROVED` (D1). Entram:

| Code                                  | HTTP | Quando                                                     |
| ------------------------------------- | ---- | ---------------------------------------------------------- |
| `STORE_LIVE_NOT_ENABLED`              | 422  | Operacao LIVE numa loja cujo `liveStatus` nao e `APPROVED`  |
| `INVALID_STORE_LIVE_STATUS_TRANSITION`| 422  | Transicao fora da tabela de D8                             |
| `OPERATOR_DECISION_REASON_REQUIRED`   | 422  | Decisao da mesa sem motivo, ou com motivo em branco         |

Todos na categoria `BUSINESS`, como os vizinhos. Nenhum e 500: a recusa de LIVE
e um fato de dominio, nao uma falha.

`LIVE_ENVIRONMENT_NOT_ALLOWED` continua existindo, com o significado que
sobrou: **caminho que nao tem versao LIVE nenhuma** (saque, estorno). Deixa de
significar "LIVE nunca" e passa a significar "LIVE nao existe aqui" -- e a
distincao importa, porque a primeira recusa some nesta fatia e a segunda nao.

## Migration

```sql
CREATE TYPE "StoreLiveStatus" AS ENUM
  ('NOT_REQUESTED', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

ALTER TABLE "stores"
  ADD COLUMN "live_status" "StoreLiveStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN "live_status_reason" TEXT,
  ADD COLUMN "live_status_changed_at" TIMESTAMP(3);

ALTER TABLE "stores" DROP COLUMN "is_approved";
```

Sem backfill, e sem loja perdendo nada:

- Toda loja existente nasce `NOT_REQUESTED`, que significa "opera em TEST, LIVE
  fechado". **E exatamente o que e verdade hoje**: nenhum caminho credita LIVE,
  e o ledger LIVE de toda loja tem saldo zero (verificado na fatia 2).
- `DROP COLUMN is_approved` nao muda comportamento porque a coluna e `true` em
  toda linha e os gates que a liam sao no-ops (ver o achado).

## Nao-objetivos desta fatia

- **Saque e estorno em LIVE.** Continuam JWT-only, e a sessao JWT e TEST. A
  fatia 2 registrou isso como "porta para uma sala vazia"; com LIVE enchendo, a
  sala deixa de ser vazia e a porta passa a valer -- mas ela precisa do seletor
  de ambiente no dashboard, que e produto proprio.
- **Seletor de ambiente no dashboard.** O dashboard continua TEST por sessao.
- **Condicao comercial** (taxa e prazo). Fatia 4.
- **Leitura cross-merchant para investigar chamado.** Fatia 5. `GET
  /operator/stores` le o minimo da fila, e nada alem.
- **Tela de operador em `apps/web`.** A mesa e API nesta fatia, como a trilha
  foi na fatia 1.
- **KYC de verdade.** O simulador representa os estados de uma analise sem
  fingir que faz a analise.
- **Papeis dentro de `Operator`**, impersonacao, MFA, retencao da trilha.
- **Notificar o lojista** da decisao por webhook ou e-mail. O estado e legivel
  em `GET /stores`; evento de ciclo de vida de loja e catalogo proprio.

## Criterios de aceite

- Loja recem-criada cobra em TEST sem passar por aprovacao nenhuma, e
  `liveStatus` dela e `NOT_REQUESTED`.
- Loja sem habilitacao nao cobra em LIVE: a recusa e `STORE_LIVE_NOT_ENABLED`,
  422, com code no catalogo -- provado por teste, em criacao **e** em simulacao.
- Loja aprovada cobra, confirma e acumula saldo em LIVE, e o teste le **as duas
  contas** depois de confirmar: o credito esta na conta LIVE e a conta TEST nao
  mudou.
- Loja suspensa volta a receber `STORE_LIVE_NOT_ENABLED` em LIVE, inclusive para
  `Payment` LIVE que ja estava `PENDING`.
- O `SettlementJob` continua liberando pagamento LIVE de loja suspensa (D4).
- Nenhuma mudanca de `liveStatus` existe sem linha correspondente na trilha, com
  `before`, `after` e `reason` preenchidos -- provado por teste que conta linhas.
- Decisao sem motivo e recusada pelo use case, com
  `OPERATOR_DECISION_REASON_REQUIRED`, chamando o use case direto.
- Transicao fora da tabela de D8 e recusada pela entidade.
- `grep -r isApproved` nao acha nada em `apps` nem em `packages/*/src`.
- Nenhuma loja existente perde acesso a TEST pela migration.
- `GET /operator/stores` nao devolve saldo, pagamento, secret de webhook nem
  chave de API.
- Token de merchant continua recebendo 401 nas rotas novas de `/operator`, e o
  teste de varredura de rotas continua verde com os controllers novos.
- A tela diz que LIVE tambem e simulacao, e `financials.html` para de dizer que
  TEST e LIVE dividem o mesmo saldo.
- `CURRENT_STATE.md` e `PRODUCT.md` descrevem a habilitacao e o que ela
  destrava; a Matriz de Maturidade sai de "Parcial: existe a fronteira, nao
  existe a mesa".
- CI verde: `lint:check`, `format:check`, `build`, testes de core,
  infrastructure, api, worker e web, `api-e2e`, e `smoke:docker` com
  `p0,withdrawals`.

## Ordem de implementacao

Tres PRs, na ordem parede -> porta -> destravar. Cada um e entregavel sozinho e
deixa a `main` num estado inteiro.

### PR 1 -- separar habilitacao de "loja ativa"

Termina com LIVE fechado para todo mundo, que e o comportamento de hoje. Nada
muda para nenhum usuario.

1. Schema + migration (enum, tres colunas, `DROP COLUMN is_approved`).
2. `Store`: `liveStatus`, `isLiveEnabled()` e os quatro metodos de transicao de
   D8, sem ninguem chamando ainda.
3. Remocao de `isApproved` dos cinco use cases, do `StoreRepository`
   (`listActiveApproved` -> `listActive`), do SQL de `findWithPendingBalance`,
   dos DTOs de API e de `apps/web`, e do catalogo de erros.
4. `assertLiveEnvironmentEnabled` e o gate nos tres caminhos de criacao
   (`create-payment`, `create-checkout-session`, `create-payment-link`).

### PR 2 -- a mesa decide, e a trilha registra

Termina com uma loja podendo chegar em `APPROVED` -- ainda sem efeito
observavel, porque a simulacao LIVE so abre no PR 3.

5. `POST /stores/:id/live-request` e `liveStatus` no `GET /stores`.
6. Use cases de decisao, gravando a trilha na mesma transacao, com `reason`
   obrigatorio.
7. `GET /operator/stores` e `POST /operator/stores/:id/live-status`, com as
   acoes novas em `OPERATOR_AUDIT_ACTION`.

### PR 3 -- destravar LIVE, e dizer a verdade sobre ele

8. Gates de simulacao: `dev.controller` para de recusar key LIVE;
   `confirm/expire/fail/release`, `pay-payment-link`, `fail-payment-link` e
   `simulate-checkout-payment` trocam "LIVE nunca" por "LIVE se habilitada".
9. Testes de isolamento: loja nao habilitada recusada em LIVE; loja habilitada
   creditando **o ledger LIVE** com o TEST intacto.
10. Tela: LIVE e simulacao, e a correcao de `financials.html`.
11. Docs: `CURRENT_STATE.md`, `PRODUCT.md`, `EVENTS.md` se algum envelope mudar,
    e o README da API.

## Riscos

| Risco                                                | Como aparece                                              | O que segura                                                                     |
| ---------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Caminho de simulacao esquecido no PR 3               | Loja nao habilitada credita LIVE                          | Teste por caminho (dev, payment link, checkout), listados um a um em D5           |
| Gate novo aplicado tambem em TEST                    | Loja nova para de cobrar -- quebra a promessa do produto   | D3, e teste de que loja `NOT_REQUESTED` cobra em TEST                             |
| Trilha escrita fora da transacao                     | `liveStatus` muda sem linha correspondente                | Repositorio da trilha so existe em `ITransactedRepositories` (fatia 1)            |
| `reason` validado so no DTO                          | Cliente HTTP direto decide sem motivo                     | D6: validacao no use case, e teste que chama o use case sem passar pelo controller|
| Suspensao prendendo dinheiro em `pending`            | Saldo LIVE preso para sempre                              | D4: o `SettlementJob` e excecao explicita, com teste                              |
| `apps/web` quebrando com a remocao de `isApproved`   | Build do dashboard falha                                  | PR 1 remove o campo em API e web na mesma passagem; `web-test` no CI              |

## O que reabre estas decisoes

- **Adquirente de verdade** -> a opcao B deixa de valer, LIVE para de ser
  simulado, e a tela de D9 muda de significado.
- **Seletor de ambiente no dashboard** -> saque e estorno em LIVE deixam de
  estar bloqueados por acidente de sessao e viram decisao de produto.
- **Mais de um perfil de operador** -> aprovar loja e o primeiro poder que
  alguem vai querer separar de "ler dado", e papeis dentro de `Operator` deixam
  de ser adivinhacao.
- **Volume de pedidos que uma pessoa nao da conta** -> a fila vira produto (SLA,
  atribuicao, priorizacao), e nao mais uma listagem filtrada.
