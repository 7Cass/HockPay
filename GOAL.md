# Hockpay - Goal

Source repo: `/Users/jpcass/Documents/2026/hockpay`
Last reviewed: `2026-09-11`
Scope: **a definir**
Status: `sem goal ativa`

A passagem anterior (arquivada em `docs/goals/2026-09-10-desk-money-screen.md`) deu
tela ao que a de `2026-09-09` deixou so por `curl`: a mesa saca e estorna pela loja
de dentro da investigacao, com dois passos, motivo na trilha e a chave de
idempotencia presa a intencao. Para isso a mesa ganhou a leitura dos destinos Pix da
loja, que nao existia. No caminho, o parser de reais do painel do lojista -- que lia
`10.50` como R$ 1.050,00 -- foi trocado pelo parser estrito da mesa, agora em `core/`.

Este arquivo volta a ser o tracker executavel quando a proxima goal for escolhida.

## Onde o projeto esta

Cinco das seis fatias do PRD pai estao no runtime, e a mesa tem quatro poderes, todos
com tela: habilitar LIVE, condicao comercial, leitura para investigar e mover dinheiro
pela loja.

| Fatia | Estado         | O que deu                                                                      |
| ----- | -------------- | ------------------------------------------------------------------------------ |
| 1     | `concluido`    | Principal `Operator`, segredo e cookies proprios, trilha append-only           |
| 2     | `concluido`    | `Account` unica por `storeId + environment`                                    |
| 3     | `concluido`    | `Store.liveStatus`, a mesa que decide, e a simulacao em LIVE que isso destrava |
| 4     | `concluido`    | Condicao comercial -- taxa, fixo e prazo, auditados e com faixa no dominio     |
| 5     | `concluido`    | Leitura cross-merchant para investigar chamado, sem secret                     |
| 6     | `nao iniciado` | Antifraude como modulo, alimentando a fila de revisao                          |

## Candidatas a proxima passagem

Nenhuma escolhida.

### B. Versionar os smokes que ja rodaram

Tres ciclos de validacao contra a API de verdade -- dois em `2026-09-08` e o da mesa
movendo dinheiro em `2026-09-10` -- foram script descartavel.

- **A favor:** o ultimo script ja e o esqueleto de um `smoke:operator`, com 21
  assercoes que cobrem leitura, saque, replay, conflito de chave, estorno e trilha.
  Nao existe smoke nenhum da mesa, e ela escreve no ledger.
- **Contra:** nao muda invariante nem destrava capacidade; e seguro puro.

### C. Fatia 6 -- antifraude e a fila de revisao

O ultimo passo do PRD pai, e a unica fatia que ainda precisa de PRD do zero.

- **A favor:** fecha o PRD pai, e a pre-condicao existe -- a mesa tem tela, trilha,
  leitura de dado de loja e agora os dois movimentos de dinheiro.
- **Contra:** e a maior das restantes, e trabalho de modelagem, nao de superficie.

### D. Acabamento da mesa

Total nas paginacoes da fila e da trilha, validacao de `limit`/`offset` nas duas
rotas que fazem parse a mao, retencao da trilha e a mensagem vazia do `@IsEnum`.

- **A favor:** barato, e a mesa e a superficie mais nova do produto.
- **Contra:** nenhum item sozinho justifica uma passagem.

## Corrigidos fora de passagem

- **O painel do lojista lia `10.50` como R$ 1.050,00** -- corrigido em `2026-09-11`,
  no mesmo PR da tela da mesa. As quatro paginas que convertem reais (produtos,
  Payment Links, saques e estorno) usam o parser estrito de `core/money/reais.ts`.
  Valor fora do formato continua valendo zero para as validacoes de cada pagina, que
  ja recusavam zero: o formulario nao ganhou mensagem nova de formato.

## Achados abertos, sem dono

- **Nada revoga um access token em voo.** Consequencia de D1/D2 do PRD do seletor.
  Desde `2026-09-09` a janela nao custa dinheiro, porque todo caminho que move
  dinheiro rele a loja.
- **`@IsEnum` recebendo array em vez de enum** em `operator-store.dto.ts`
  (`decision`): valida certo, mas a mensagem de erro lista os valores aceitos vazia.
- **Deletar store com saque falha mesmo com tudo em CASCADE** --
  `withdrawals.bank_account_id` e `RESTRICT`. So aparece em delete de store, que a
  aplicacao nao faz.
- **O exemplo de saque no `RUNBOOK` esta errado** -- usa API key, e saque e JWT-only.
  O `RUNBOOK` tambem nao documenta nenhuma rota de operador.
- **A decisao da mesa nao revoga a sessao do lojista.** Quem rebaixa e o proximo
  login ou refresh.
- **`?limit=abc` vira `NaN`** na fila e na trilha.
- **Ambiente e por sessao, e nao por aba.**
- **Nenhum teste cobre texto de tela.**
- **Trilha de operador cresce sem retencao.** Decisao registrada, nao esquecida.
- **A politica de saque existe em tres lugares** -- no core, no painel do lojista e
  no admin. As telas so avisam; a API decide.

## Passagens anteriores

- `docs/goals/2026-08-18-architecture-hardening.md`
- `docs/goals/2026-08-18-workspace-honesty-and-integrity.md`
- `docs/goals/2026-08-19-leftover-authz-and-read-isolation.md`
- `docs/goals/2026-08-19-test-live-identity-isolation.md`
- `docs/goals/2026-09-06-operator-boundary-and-environment-ledger.md`
- `docs/goals/2026-09-07-live-onboarding.md`
- `docs/goals/2026-09-08-operator-desk-and-environment-selector.md`
- `docs/goals/2026-09-09-suspended-store-money.md`
- `docs/goals/2026-09-10-desk-money-screen.md`
