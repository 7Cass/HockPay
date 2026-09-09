# Hockpay - Goal

Source repo: `/Users/jpcass/Documents/2026/hockpay`
Last reviewed: `2026-09-09`
Scope: **a definir**
Status: `sem goal ativa`

A passagem anterior (arquivada em `docs/goals/2026-09-09-suspended-store-money.md`)
fechou a correcao que o `CURRENT_STATE` registrava desde `2026-09-08`: loja sem
habilitacao LIVE parou de sacar e de estornar por conta propria, e a mesa ganhou as
duas rotas que movem esse dinheiro por chamado, com motivo, trilha e idempotencia.

Este arquivo volta a ser o tracker executavel quando a proxima goal for escolhida.

## Onde o projeto esta

Cinco das seis fatias do PRD pai estao no runtime, e a mesa tem quatro poderes:

| Fatia | Estado         | O que deu                                                                      |
| ----- | -------------- | ------------------------------------------------------------------------------ |
| 1     | `concluido`    | Principal `Operator`, segredo e cookies proprios, trilha append-only           |
| 2     | `concluido`    | `Account` unica por `storeId + environment`                                    |
| 3     | `concluido`    | `Store.liveStatus`, a mesa que decide, e a simulacao em LIVE que isso destrava |
| 4     | `concluido`    | Condicao comercial -- taxa, fixo e prazo, auditados e com faixa no dominio     |
| 5     | `concluido`    | Leitura cross-merchant para investigar chamado, sem secret                     |
| 6     | `nao iniciado` | Antifraude como modulo, alimentando a fila de revisao                          |

Fora do PRD pai: o ambiente da sessao mora em `Merchant.currentEnvironment`, saque e
estorno alcancam o ledger LIVE, e -- desde `2026-09-09` -- a habilitacao LIVE fecha
os **dois sentidos** do dinheiro, com a mesa como saida da loja fechada.

## Candidatas a proxima passagem

Nenhuma escolhida. A opcao A e a continuacao direta do que acabou de entrar, e a
mais barata: o backend existe e so falta a superficie.

### A. A tela da mesa para mover dinheiro

As duas rotas de saque e estorno pela loja existem e nao tem tela. Um chamado de
retirada de loja suspensa se resolve hoje por `curl`.

- **A favor:** e exatamente o argumento que justificou a passagem de `2026-09-08` --
  capacidade que so existe por `curl` e capacidade que ninguem opera. O backend esta
  pronto, testado e com a trilha ja legivel na propria superficie da mesa, entao a
  passagem e quase toda tela.
- **Contra:** e a primeira tela da mesa que **move dinheiro**, e ela precisa de
  confirmacao explicita, do saldo na frente de quem decide, e de um jeito de nao
  fazer duas vezes o que a idempotencia so protege se a chave for a mesma.

### B. Versionar os smokes que ja rodaram

O `GOAL` anterior ja apontava que os dois ciclos de `2026-09-08` foram script
descartavel. Agora ha uma terceira superficie sem smoke, e ela escreve no ledger.

- **A favor:** trabalho pequeno com valor permanente. Nao existe `smoke:operator`,
  nem `smoke:environment`, nem nada que cubra a mesa movendo dinheiro.
- **Contra:** nao muda invariante nem destrava capacidade; e seguro puro.

### C. Fatia 6 -- antifraude e a fila de revisao

O ultimo passo do PRD pai, e a unica fatia que ainda precisa de PRD do zero.

- **A favor:** fecha o PRD pai, e a pre-condicao existe -- a mesa tem tela, trilha e
  leitura de dado de loja.
- **Contra:** e a maior das restantes, e trabalho de modelagem, nao de superficie.

### D. Acabamento da mesa

Total nas paginacoes da fila e da trilha, validacao de `limit`/`offset` nas duas
rotas que fazem parse a mao, e retencao da trilha.

- **A favor:** barato, e a mesa e a superficie mais nova do produto.
- **Contra:** nenhum item sozinho justifica uma passagem.

## Corrigidos fora de passagem

- **Logout de merchant nao revogava o refresh token no banco** -- corrigido em
  `2026-09-08`. O `LogoutUseCase` nunca era chamado, porque `hockpay_rt` tem path
  `/api/v1/auth/refresh` e o browser nao o manda para `/api/v1/auth/logout`. A rota
  respondia `204` e a sessao seguia viva por sete dias.

## Achados abertos, sem dono

- **Nada revoga um access token em voo.** Trocar de ambiente nao invalida o access
  anterior (so o refresh), e o mesmo vale para a suspensao e para o "ambiente por
  sessao, nao por aba". Nao e defeito: e consequencia de D1/D2 do PRD do seletor.
  Desde `2026-09-09` a janela **nao custa mais dinheiro** -- todo caminho que move
  dinheiro rele a loja --, mas ela continua existindo para tudo que nao e dinheiro.
- **A via da mesa nao tem tela.** Ver a opcao A.
- **`@IsEnum` recebendo array em vez de enum** em `operator-store.dto.ts`
  (`decision`): valida certo, mas a mensagem de erro lista os valores aceitos
  **vazia**.
- **Deletar store com saque falha mesmo com tudo em CASCADE** --
  `withdrawals.bank_account_id` e `RESTRICT` e o cascade tenta apagar o destino Pix
  antes do saque. So aparece em delete de store, que a aplicacao nao faz.
- **O exemplo de saque no `RUNBOOK` esta errado** -- usa
  `Authorization: Bearer hk_test_xxx`, e saque e JWT-only desde a fatia de
  autorizacao. O `RUNBOOK` tambem nao documenta nenhuma rota de operador.
- **A decisao da mesa nao revoga a sessao do lojista.**
  `DecideLiveEnablementUseCase` nao mexe em token nem em `currentEnvironment`; quem
  rebaixa e o proximo login ou refresh.
- **`?limit=abc` vira `NaN`** na fila e na trilha, as duas rotas de operador que
  fazem parse de paginacao a mao.
- **Ambiente e por sessao, e nao por aba.** O cookie e do browser inteiro; abas ja
  renderizadas seguem mostrando o ambiente anterior ate recarregarem.
- **Nenhum teste cobre texto de tela.** Ja aconteceu duas vezes: `financials.html`
  na fatia 2, e a descricao do saldo na fatia 3.
- **Trilha de operador cresce sem retencao.** Decisao registrada, nao esquecida.

## Passagens anteriores

- `docs/goals/2026-08-18-architecture-hardening.md`
- `docs/goals/2026-08-18-workspace-honesty-and-integrity.md`
- `docs/goals/2026-08-19-leftover-authz-and-read-isolation.md`
- `docs/goals/2026-08-19-test-live-identity-isolation.md`
- `docs/goals/2026-09-06-operator-boundary-and-environment-ledger.md`
- `docs/goals/2026-09-07-live-onboarding.md`
- `docs/goals/2026-09-08-operator-desk-and-environment-selector.md`
- `docs/goals/2026-09-09-suspended-store-money.md`
