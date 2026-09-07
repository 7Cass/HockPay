# Hockpay - Goal

Source repo: `/Users/jpcass/Documents/2026/hockpay`
Last reviewed: `2026-09-07`
Scope: **a definir**
Status: `sem goal ativa`

A passagem anterior (arquivada em `docs/goals/2026-09-07-live-onboarding.md`) fechou a fatia 3 do [PRD da superficie de operador](docs/PRD_OPERATOR_SURFACE.md): existe habilitacao LIVE por loja, a mesa aprova/rejeita/suspende com motivo e rastro, e loja aprovada acumula saldo no ledger LIVE.

Este arquivo volta a ser o tracker executavel quando a proxima goal for escolhida.

## Onde o projeto esta

Tres das seis fatias do PRD pai estao no runtime:

| Fatia | Estado         | O que deu                                                                      |
| ----- | -------------- | ------------------------------------------------------------------------------ |
| 1     | `concluido`    | Principal `Operator`, segredo e cookies proprios, trilha append-only           |
| 2     | `concluido`    | `Account` unica por `storeId + environment`                                    |
| 3     | `concluido`    | `Store.liveStatus`, a mesa que decide, e a simulacao em LIVE que isso destrava |
| 4     | `nao iniciado` | Condicao comercial -- taxa e prazo, auditados                                  |
| 5     | `nao iniciado` | Visao cross-merchant -- leitura para investigar chamado                        |
| 6     | `nao iniciado` | Antifraude como modulo, alimentando a fila de revisao                          |

## Candidatas a proxima passagem

Nenhuma decidida. As opcoes A, D e a fatia 6 seguem a ordem do PRD pai; B e C furariam a fila.

### A. Fatia 4 -- condicao comercial

Taxa e prazo (`feePercent`, `feeFixed`, `settlementDays`) editaveis pela mesa, auditados, valendo so para o futuro. `Payment.fee` ja e snapshot no momento da cobranca, entao o passado permanece explicavel sem trabalho extra.

- **A favor:** e a proxima na ordem do PRD, e o segundo poder da mesa reusa tudo que a fatia 3 construiu (rota, decisao, trilha com `before`/`after`, motivo obrigatorio). Provavelmente a mais barata das restantes.
- **Contra:** e o segundo poder da mesa antes de existir qualquer tela de operador. A mesa acumula poder que so se opera por `curl`.

### B. Seletor de ambiente no dashboard

Furaria a fila. O dashboard e TEST por sessao, e agora existe saldo LIVE que ninguem consegue ver, sacar ou estornar.

- **A favor:** e a divida que a fatia 3 criou. Sem ela, aprovar uma loja para LIVE produz um saldo que so aparece por API -- o oposto do que a fatia 3 existe para ensinar. Destrava saque e estorno em LIVE, hoje bloqueados por acidente de sessao e nao por decisao.
- **Contra:** nao esta em nenhum PRD ainda, e mexe em autenticacao (a sessao JWT carrega o ambiente) alem da tela.

### C. Tela de operador em `apps/web`

A mesa tem fronteira, trilha e um poder, e nada disso tem tela.

- **A favor:** o PRD pai diz que "trilha que so existe no banco nao e trilha, e log" -- e hoje ela so existe por API. A superficie de operador e parte do que o simulador ensina, e ninguem aprende por `curl`.
- **Contra:** e a primeira tela de um principal novo (layout, auth, rotas), custo alto para zero capacidade nova.

### D. Fatia 5 -- visao cross-merchant

Leitura de payments, ledger, webhooks e timeline de qualquer loja, para investigar chamado.

- **A favor:** e o poder que um operador real usa mais, e o unico que da conteudo de verdade para uma tela de operador.
- **Contra:** e a fatia com mais superficie de leitura para escapar do que o PRD pai permite (nenhum secret, nenhuma chave), e pede tela quase por definicao.

## Achados abertos, sem dono

- **Logout de merchant nao revoga o refresh token no banco.** `hockpay_rt` vive em `/api/v1/auth/refresh` e nunca chega na rota de logout -- a mesma forma do bug de operador corrigido na passagem de `2026-09-06`. Registrado desde entao, sem correcao.
- **Nenhum teste cobre texto de tela.** A frase "TEST e LIVE dividem o mesmo saldo" em `financials.html` sobreviveu uma passagem inteira depois de virar mentira; foi corrigida na fatia 3 por inspecao, nao por teste.
- **Trilha de operador cresce sem retencao.** Decisao registrada, nao esquecida.

## Passagens anteriores

- `docs/goals/2026-08-18-architecture-hardening.md`
- `docs/goals/2026-08-18-workspace-honesty-and-integrity.md`
- `docs/goals/2026-08-19-leftover-authz-and-read-isolation.md`
- `docs/goals/2026-08-19-test-live-identity-isolation.md`
- `docs/goals/2026-09-06-operator-boundary-and-environment-ledger.md`
- `docs/goals/2026-09-07-live-onboarding.md`
