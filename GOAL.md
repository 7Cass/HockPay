# Hockpay - Goal

Source repo: `/Users/jpcass/Documents/2026/hockpay`
Last reviewed: `2026-09-08`
Scope: **a definir**
Status: `sem goal ativa`

A passagem anterior (arquivada em `docs/goals/2026-09-08-operator-desk-and-environment-selector.md`) fechou as fatias 4 e 5 do [PRD da superficie de operador](docs/PRD_OPERATOR_SURFACE.md) e deu tela as tres: a mesa habilita loja para LIVE, muda condicao comercial e le dado de loja para investigar chamado, tudo sem `curl`. E o lojista passou a enxergar o ledger LIVE, com seletor de ambiente na topbar.

Este arquivo volta a ser o tracker executavel quando a proxima goal for escolhida.

## Onde o projeto esta

Cinco das seis fatias do PRD pai estao no runtime:

| Fatia | Estado         | O que deu                                                                      |
| ----- | -------------- | ------------------------------------------------------------------------------ |
| 1     | `concluido`    | Principal `Operator`, segredo e cookies proprios, trilha append-only           |
| 2     | `concluido`    | `Account` unica por `storeId + environment`                                    |
| 3     | `concluido`    | `Store.liveStatus`, a mesa que decide, e a simulacao em LIVE que isso destrava |
| 4     | `concluido`    | Condicao comercial -- taxa, fixo e prazo, auditados e com faixa no dominio     |
| 5     | `concluido`    | Leitura cross-merchant para investigar chamado, sem secret                     |
| 6     | `nao iniciado` | Antifraude como modulo, alimentando a fila de revisao                          |

Fora do PRD pai, a passagem anterior tambem fechou a divida da fatia 3: o ambiente da sessao mora em `Merchant.currentEnvironment`, e saque e estorno alcancam o ledger LIVE.

## Candidatas a proxima passagem

Nenhuma escolhida. A opcao A tem a decisao de produto ja tomada, o que a torna a mais barata de comecar -- e a unica que corrige comportamento existente em vez de acrescentar.

### A. Loja suspensa nao movimenta dinheiro, e a mesa movimenta por ela

Decidido em `2026-09-08`: loja com o LIVE suspenso nao faz movimentacao financeira por conta propria. Saque e estorno de loja suspensa viram trabalho da mesa, por chamado, como num gateway de verdade.

- **A favor:** e correcao de comportamento, nao capacidade nova -- hoje `create-payment` recusa em loja suspensa mas `create-withdrawal` nao, entao dinheiro nao entra e sai. A decisao de produto ja esta tomada e escrita, o que dispensa a metade cara do PRD.
- **Contra:** precisa das duas metades. So o gate deixaria o saldo LIVE de uma loja suspensa sem saida nenhuma, e a mesa nao tem nenhuma rota que mova dinheiro hoje -- e o primeiro poder da mesa que **escreve no ledger**, com tudo que isso implica de idempotencia e trilha.

### B. Ver funcionando o que ja existe

A passagem anterior fechou com seis itens de validacao em aberto, e o primeiro deles -- a migration nunca aplicada contra banco nenhum -- bloqueia os outros cinco.

- **A favor:** e a diferenca entre "a capacidade existe" e "a capacidade foi vista funcionando", e duas passagens inteiras (mesa e seletor) estao do lado errado dessa linha. A fatia 3 fechou com todos os itens verdes; esta nao. Nao ha smoke de operador nem de seletor de ambiente.
- **Contra:** nao entrega nada novo, e o risco que ela cobre e desconhecido por definicao -- pode nao achar nada.

### C. Fatia 6 -- antifraude e a fila de revisao

O ultimo passo do PRD pai. O motor produz sinal; a fila de revisao e onde a mesa decide sobre ele.

- **A favor:** fecha o PRD pai, e agora a pre-condicao que ele exigia existe -- a mesa tem tela, trilha e leitura de dado de loja, que e do que uma fila de revisao e feita.
- **Contra:** e a maior das restantes, e a unica que precisa de PRD do zero. O `DetectAnomaliesUseCase` stub foi removido de proposito na fatia 3 por devolver lista vazia; refaze-lo de verdade e trabalho de modelagem, nao de superficie.

### D. Acabamento da mesa

Total nas paginacoes da fila e da trilha (e o `Pagination` que depende dele), validacao de `limit`/`offset` nas duas rotas que fazem parse a mao, e retencao da trilha.

- **A favor:** barato, e a mesa e a superficie mais nova do produto -- e onde o atrito ainda nao foi gasto por uso.
- **Contra:** nenhum item sozinho justifica uma passagem, e nenhum deles muda invariante.

## Corrigidos fora de passagem

- **Logout de merchant nao revogava o refresh token no banco** -- corrigido em `2026-09-08`. Era pior do que o registro dizia: o `LogoutUseCase` nunca era chamado, porque `hockpay_rt` tem path `/api/v1/auth/refresh` e o browser nao o manda para `/api/v1/auth/logout`. A rota respondia `204` e a sessao seguia viva por sete dias. Passou a revogar pelo principal autenticado, como o lado do operador ja fazia desde `2026-09-06`.

## Achados abertos, sem dono

- **Loja suspensa continua sacando em LIVE.** Ate 15 minutos depois da suspensao, que e o TTL do access token. Ver a opcao A; enquanto ela nao acontece, esta escrito como defeito conhecido no `CURRENT_STATE`.
- **A decisao da mesa nao revoga a sessao do lojista.** `DecideLiveEnablementUseCase` nao mexe em token nem em `currentEnvironment`; quem rebaixa e o proximo login ou refresh.
- **`?limit=abc` vira `NaN`** na fila e na trilha, as duas rotas de operador que fazem parse de paginacao a mao.
- **Ambiente e por sessao, e nao por aba.** O cookie e do browser inteiro; abas ja renderizadas seguem mostrando o ambiente anterior ate recarregarem.
- **Nenhum teste cobre texto de tela.** Ja aconteceu duas vezes: `financials.html` na fatia 2, e a descricao do saldo na fatia 3. As duas foram achadas por inspecao, uma passagem depois de virarem mentira.
- **Trilha de operador cresce sem retencao.** Decisao registrada, nao esquecida.

## Passagens anteriores

- `docs/goals/2026-08-18-architecture-hardening.md`
- `docs/goals/2026-08-18-workspace-honesty-and-integrity.md`
- `docs/goals/2026-08-19-leftover-authz-and-read-isolation.md`
- `docs/goals/2026-08-19-test-live-identity-isolation.md`
- `docs/goals/2026-09-06-operator-boundary-and-environment-ledger.md`
- `docs/goals/2026-09-07-live-onboarding.md`
- `docs/goals/2026-09-08-operator-desk-and-environment-selector.md`
