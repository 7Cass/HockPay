# Hockpay - Goal (arquivada)

Arquivada em `2026-09-06`. Goal ativa em `/GOAL.md` (fatia 3: onboarding LIVE).

Source repo: `/Users/jpcass/Documents/2026/hockpay`
Last reviewed: `2026-09-06`
Ordering: fronteira antes de poder; parede antes de porta
Scope: fatias 1 e 2 da superficie de operador -- principal `Operator` com trilha de auditoria, e ledger separado por ambiente
Status final: `concluido`

Esta passagem nasceu do [PRD da superficie de operador](../PRD_OPERATOR_SURFACE.md), que descreve uma mesa interna (aprovar loja, ajustar taxa, investigar chamado) que o hockpay nao tinha. O PRD corta a construcao em seis passos; esta passagem fechou os dois primeiros, que sao os que nao produzem tela e existem para que os outros quatro nao sejam construidos errados.

## O que entrou

| PR  | Entrega                                                                                 |
| --- | --------------------------------------------------------------------------------------- |
| #7  | [PRD da fatia 1](../PRD_OPERATOR_AUTHZ.md) -- fronteira de autorizacao e trilha         |
| #8  | `aud` obrigatorio no JWT de merchant, sozinho num PR                                    |
| #9  | Fatia 1: principal `Operator`, trilha append-only, `/operator/*`, CLI `operator:create` |
| #10 | Fatia 2: `Account` unica por `storeId + environment`                                    |

Os PRDs de fatia (`PRD_OPERATOR_AUTHZ.md` e `PRD_ENVIRONMENT_LEDGER.md`) ficam como registro das decisoes; o runtime esta descrito em `CURRENT_STATE.md`.

## Decisoes que valem para as proximas fatias

- **Principal separado, com segredo proprio.** `Operator` nao tem relacao com `Merchant`, e o token de operador e assinado com `OPERATOR_JWT_SECRET`. A fronteira nao depende de alguem lembrar de checar audiencia: com segredos distintos, um token de merchant nao verifica numa rota de operador.
- **`@OperatorRoute()` e marca e guarda ao mesmo tempo.** O decorator tira a rota do guard global de merchant **e** instala o `OperatorAuthGuard`. Nao existe forma de declarar rota de operador e deixa-la sem guarda; um teste de varredura falha se um controller do modulo sair dessa forma.
- **Trilha alcancavel so pela transacao.** `IOperatorAuditLogRepository` nao tem `update` nem `delete`, e o repositorio existe apenas dentro de `ITransactedRepositories`. Escrever uma linha exige estar na transacao que aplica a mudanca descrita.
- **Assinatura antiga sai da porta.** No ledger, `findByStoreId`/`findByStoreIdForUpdate` foram removidas em vez de ganharem parametro opcional -- foi o que transformou a migracao numa lista que o compilador entregou, em vez de uma revisao linha a linha.
- **Entrada de dinheiro em LIVE: opcao B** (registrada em `PRD_ENVIRONMENT_LEDGER.md`). Simulacao tambem em LIVE, liberada so para loja aprovada. Isso expande a fatia 3, que deixa de ser "aprovar loja" e passa a ser "aprovar loja e destravar a simulacao em LIVE".

## Achados que mudaram o plano

- **Nao existe dinheiro LIVE, e nao havia caminho que criasse.** Todo caminho que credita conta recusa LIVE (`/dev/simulate` rejeita key LIVE; pay de Payment Link e fulfill de checkout recusam LIVE no use case; refund e saque sao JWT-only, sempre TEST). `ConfirmPaymentUseCase` so e alcancavel pelo `dev.controller`. Por isso a migration do ledger foi um corte, nao uma reconciliacao: nenhum saldo misto para dividir, e `Transaction.balanceAfter` historico continua verdadeiro.
- **O logout de operador nao revogava nada.** Apareceu rodando o fluxo real, nao nos testes: o cookie de refresh vive em `/api/v1/operator/auth/refresh` e nunca chega na rota de logout. Passou a revogar pelo operador autenticado. **O logout de merchant tem a mesma forma** (`hockpay_rt` com path restrito, lido em `/auth/logout`) e provavelmente nunca revogou o token no banco -- nao foi corrigido nesta passagem.
- **`Store.isApproved` nao e "habilitada para producao".** E um gate de tudo: bloqueia `create-payment`, `create-checkout-session`, `create-payment-link`, `create-withdrawal` e `switch-store` em qualquer ambiente, e nasce `true` com `// Auto-approve for MVP`. E o no central da fatia 3.

## Limpezas que vieram junto

- `generateRefreshToken` removido do port e do service (sem chamador; o refresh token e base64 opaco no banco).
- `db:seed` removido do `packages/database` (apontava para um `prisma/seed.ts` inexistente), com o README do pacote alinhado.
- Duas linhas de doc que ainda diziam Payment Link amount-only, corrigidas.

## Validation Log

- [x] `pnpm --filter @hockpay/core test:ci` (231)
- [x] `pnpm --filter @hockpay/infrastructure test` (79)
- [x] `pnpm --filter @hockpay/api test` (166)
- [x] `pnpm --filter @hockpay/api test:e2e` (19)
- [x] `pnpm --filter @hockpay/worker test` (33)
- [x] `pnpm --filter @hockpay/web test -- --watch=false` (68)
- [x] `pnpm run lint:check`, `pnpm run format:check`, `pnpm build`
- [x] `smoke:docker` com `db-concurrency,idempotency` (fatia 1) e `p0,withdrawals` (fatia 2)
- [x] Fluxo de operador exercitado contra Postgres local: login, `/operator/me`, trilha com `requestId`, logout, e 401 cruzado nos quatro sentidos (cookie de merchant, token de merchant no cookie de operador, sessao de operador em rota de merchant, API key)

## Fora desta passagem

- Poder de operador (aprovar, suspender, taxa, leitura cross-merchant).
- Tela de operador em `apps/web`.
- Papeis dentro de `Operator`, impersonacao, MFA, retencao/purga da trilha.
- Seletor de ambiente no dashboard.
- Entrada de dinheiro em LIVE, saque e estorno em LIVE.
- Antifraude como modulo.
