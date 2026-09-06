# PRD - Ledger por ambiente

> **Status: proposta. Nada descrito aqui existe no runtime.**
> Este documento detalha a **fatia 2** do
> [PRD - Superficie de operador](PRD_OPERATOR_SURFACE.md). Enquanto a Matriz de
> Maturidade do [CURRENT_STATE.md](CURRENT_STATE.md) nao registrar a mudanca,
> tudo abaixo e intencao.

Last reviewed: `2026-09-06`
Pre-requisito de: onboarding LIVE (fatia 3)
Independente de: [fronteira de autorizacao](PRD_OPERATOR_AUTHZ.md) (fatia 1, ja implementada)

## O que esta fatia entrega

`Account` deixa de ser unica por loja e passa a ser unica por loja **e**
ambiente. Duas contas por loja, saldos separados, e nenhum caminho de escrita
que consiga resolver conta sem dizer em que ambiente esta.

## O achado que muda o argumento desta fatia

O PRD pai diz que "uma key TEST ainda simula no saldo da loja" e que aprovar uma
loja para LIVE nao significa nada porque o dinheiro simulado e o "real" estao no
mesmo lugar. A primeira metade e verdade. A segunda precisa de correcao:

**Hoje nao existe dinheiro LIVE em lugar nenhum, e nao ha caminho que crie.**

Todo caminho que credita conta e TEST-only, por construcao:

| Caminho de entrada                        | Gate                                                                |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `POST /dev/simulate/:id/confirm\|release` | `dev.controller` recusa key LIVE (`LiveEnvironmentNotAllowedError`) |
| Pay autenticado/publico de Payment Link   | `pay-payment-link.use-case` recusa LIVE                             |
| `fulfill` de checkout session             | `simulate-checkout-payment.use-case` recusa LIVE                    |
| `POST /refunds`, `POST /withdrawals`      | JWT-only, e JWT e sempre TEST                                       |

`ConfirmPaymentUseCase` so e alcancavel pelo `dev.controller`. Nao existe outro
caminho para um `Payment` LIVE chegar em `CONFIRMED`, entao nenhum centavo LIVE
jamais entrou num `Account`. No banco de desenvolvimento local, conferido:
`payments` tem 44 TEST confirmados, 99 TEST expirados, 22 TEST falhados e
**zero linhas LIVE**; `withdrawals` nao tem nenhuma linha com ambiente LIVE.

Duas consequencias, e as duas facilitam:

1. **A migration e um corte, nao uma reconciliacao.** Nao e preciso dividir saldo
   existente entre ambientes, nem recalcular `Transaction.balanceAfter`: o saldo
   historico e integralmente TEST, e continua verdadeiro depois do corte.
2. **A fatia nao esta limpando uma sujeira; esta levantando a parede antes.** O
   valor dela e tornar a contaminacao impossivel por estrutura, e nao esperar o
   primeiro caso real para descobrir que o ledger nao sabia separar.

Isso tambem expoe a pergunta aberta da secao final: se nada entra em LIVE, uma
loja aprovada para LIVE ganha acesso a um ledger que ninguem consegue encher.

## Estado atual que esta fatia toca

| Onde                                                           | Fato de hoje                                                                                                                                                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/database/prisma/schema.prisma`                       | `Account.storeId` e `@unique` -- uma conta por loja                                                                                                                                                  |
| `packages/infrastructure/src/repositories/store.repository.ts` | Cria a `Account` junto com a store, dentro do repositorio                                                                                                                                            |
| `IAccountRepository`                                           | `findByStoreId` e `findByStoreIdForUpdate`, sem ambiente                                                                                                                                             |
| Escrita de saldo                                               | `settle-confirmed-payment`, `release-payment`, `create-refund`, `create-withdrawal`, `complete-withdrawal`, `fail-withdrawal`, `claim-processable-withdrawals`, `record-withdrawal-processing-error` |
| Leitura de saldo                                               | `get-account`, `list-transactions`, `list-withdrawals`, `get-withdrawal`, `get-dashboard-metrics`                                                                                                    |
| `Transaction`                                                  | Sem coluna de ambiente; pendurada na conta                                                                                                                                                           |
| `Withdrawal`                                                   | Ja tem coluna `environment` (sempre `TEST` na pratica, porque create e JWT-only)                                                                                                                     |
| `apps/web`                                                     | Nao tem seletor TEST/LIVE; o dashboard e a sessao JWT, entao e sempre TEST                                                                                                                           |

## Decisoes

### D1. `Account` unica por `(storeId, environment)`

Duas contas por loja, criadas juntas no mesmo lugar onde a conta nasce hoje
(`StoreRepository`). Criar sob demanda -- "cria a conta LIVE quando precisar" --
seria uma condicional a mais em todo caminho de escrita e um 500 esperando o
primeiro caso que esquecesse dela.

### D2. `Transaction` nao ganha coluna de ambiente

A transacao ja pendura numa conta, e a conta passa a saber o ambiente. Duplicar
o dado criaria duas fontes de verdade que podem divergir. O isolamento de
leitura de `list-transactions` sai de graca: a query ja parte da conta.

`balanceAfter` das linhas antigas continua correto porque o saldo que ele
descreve era integralmente TEST (ver o achado acima). Se algum dia houver saldo
misto para separar, essa afirmacao deixa de valer -- e por isso a fatia vem
antes de existir LIVE, e nao depois.

### D3. Resolver conta sem ambiente deixa de compilar

`findByStoreId` e `findByStoreIdForUpdate` sao **substituidas** por versoes que
exigem `environment`, em vez de ganharem um parametro opcional.

E a diferenca entre uma migracao verificada pelo compilador e uma verificada por
revisao: com a assinatura antiga viva, um caminho esquecido continua compilando
e continua escrevendo no ledger errado. Com ela removida, o TypeScript aponta os
dez pontos que resolvem conta por loja, um a um.

Os caminhos do worker de saque (`complete-withdrawal`, `fail-withdrawal`,
`claim-processable-withdrawals`, `record-withdrawal-processing-error`) resolvem
conta por `withdrawal.accountId` e nao mudam: o id da conta ja fixa o ambiente.

### D4. Migration: a conta existente vira TEST, LIVE nasce zerada

```sql
ALTER TABLE accounts ADD COLUMN environment ... DEFAULT 'TEST';
-- unique (store_id) -> unique (store_id, environment)
INSERT INTO accounts (...) SELECT ... 'LIVE', 0, 0, 0 FROM stores ...;
```

Sem divisao de saldo, porque nao ha o que dividir. O `INSERT` de contas LIVE
segue o precedente do backfill de `20260510000100_backfill_store_accounts`.

### D5. O dashboard continua sendo o ledger TEST, e passa a dizer isso

A sessao JWT e TEST, entao o dashboard passa a ler a conta TEST -- que e
exatamente o saldo que ele ja mostrava. Nenhum numero muda na tela.

O que muda e a honestidade da tela: o saldo deixa de ser "o saldo da loja" e
passa a ser "o saldo TEST da loja". Esta fatia troca o rotulo; o seletor de
ambiente no dashboard e produto proprio, e so faz sentido quando existir saldo
LIVE para selecionar.

### D6. Saque e estorno continuam TEST

`POST /withdrawals` e `POST /refunds` sao JWT-only, e JWT e TEST. Depois desta
fatia isso deixa de ser um detalhe de authz e vira uma frase sobre dinheiro:
**nao existe caminho de saque para saldo LIVE.**

Nao ha o que consertar aqui enquanto nao existir entrada em LIVE. Saida sem
entrada e uma porta para uma sala vazia.

## Como dinheiro entra em LIVE -- decidido em `2026-09-06`

Se todo caminho de entrada e TEST-only, **como dinheiro entra em LIVE?** Sem
resposta, a fatia 3 aprova lojas para um ambiente onde nada acontece.

Tres respostas possiveis:

| Opcao                                                                    | O que ensina                                                            | Custo                                                                   |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **A. LIVE fica estruturalmente vazio** ate existir adquirente de verdade | Que producao exige um trilho que o simulador nao tem                    | Aprovacao para LIVE vira cerimonia sem consequencia observavel          |
| **B. Simulacao tambem em LIVE, liberada so para loja aprovada**          | Que a diferenca entre TEST e LIVE e permissao e cerimonia, nao mecanica | Precisa deixar explicito que LIVE tambem e simulado, ou o produto mente |
| **C. Entrada LIVE operada pela mesa** (operador registra o recebimento)  | Que existe uma mesa e que toda entrada LIVE tem responsavel e rastro    | Da ao operador um poder sobre saldo -- o PRD pai proibe isso            |

**Recomendacao: B.** O objetivo declarado do projeto e ser um simulador crivel,
e um LIVE vazio nao ensina nada -- o integrador aprova a loja, aponta a key
`hk_live_` e nao acontece nada. Com B, a key LIVE de uma loja aprovada consegue
cobrar e receber, o ledger LIVE enche, e a distincao que o produto ensina passa
a ser a verdadeira num gateway: **quem pode operar em producao, e sob que
cerimonia** -- nao "de onde vem o dinheiro".

C esta descartada pelo PRD pai, que e explicito: operador nao move dinheiro. Um
botao de entrada LIVE seria exatamente o ajuste manual de saldo que transformaria
o ledger em algo que nao se pode auditar.

**Decisao: B.** Com isso a fatia 3 deixa de ser "aprovar loja" e passa a ser
**"aprovar loja e, com isso, destravar a simulacao em LIVE"**.

O que isso _nao_ muda nesta fatia: os gates de LIVE continuam onde estao. Soltar
a simulacao em LIVE antes de existir estado de habilitacao daria saldo LIVE a
qualquer loja, que e o oposto da cerimonia que a opcao B existe para ensinar. A
ordem e: parede primeiro (esta fatia), porta depois (fatia 3).

Duas consequencias que a fatia 3 herda:

- Ao destravar LIVE, a tela precisa dizer que LIVE tambem e simulado. Um LIVE que
  se apresenta como dinheiro real transforma o simulador em mentira -- e o
  projeto inteiro e construido no oposto disso.
- Saque e estorno em LIVE deixam de ser "porta para sala vazia" (D6) e passam a
  precisar de caminho proprio, porque o dashboard e TEST por sessao.

## Nao-objetivos desta fatia

- **Seletor de ambiente no dashboard.** Produto proprio (ver D5).
- **Entrada de dinheiro em LIVE.** Depende da decisao acima; fatia 3.
- **Saque/estorno em LIVE.** Ver D6.
- **`Customer` por ambiente.** Continua store-wide, como hoje.
- **Reconciliacao de saldo historico.** Nao ha saldo misto para reconciliar.
- **Qualquer poder de operador.** Fatias 3 a 5.

## Criterios de aceite

- Nenhuma escrita de saldo compila sem informar ambiente: `findByStoreId` e
  `findByStoreIdForUpdate` nao existem mais na porta.
- Loja nova nasce com duas contas; migration cria a conta LIVE de toda loja
  existente, com saldo zero.
- Simulacao TEST credita a conta TEST e **nao muda** a conta LIVE, provado por
  teste que le as duas contas depois de confirmar um pagamento.
- Saldo mostrado no dashboard depois da migration e identico ao de antes (o
  ledger TEST e o unico que tinha dinheiro).
- `list-transactions` de uma sessao TEST nao devolve transacao de conta LIVE.
- Saque continua reservando e devolvendo saldo na conta TEST, e um saque nunca
  enxerga a conta do outro ambiente.
- `CURRENT_STATE.md` deixa de dizer que `Account` e unica por store, e a secao de
  isolamento TEST/LIVE passa a descrever ledger separado.
- CI verde: `lint:check`, `format:check`, `build`, testes de core, infrastructure,
  api, worker e web, `api-e2e` e o smoke de concorrencia.

## Ordem de implementacao

Um PR so. A mudanca e larga em arquivos e estreita em conceito, e dividir em dois
deixaria a main com metade dos caminhos de escrita exigindo ambiente e a outra
metade nao -- que e pior do que os dois estados inteiros.

1. Schema + migration (coluna, unique novo, INSERT das contas LIVE).
2. Porta e repositorio: assinaturas com `environment`, sem as antigas.
3. Os dez pontos de resolucao por loja, guiados pelo compilador.
4. `StoreRepository` cria as duas contas.
5. Testes: isolamento de credito, de leitura e de saque.
6. Docs: `CURRENT_STATE.md`, `DATA_MODEL.md` e o que a API README disser sobre saldo.

## Riscos

| Risco                                          | Como aparece                           | O que segura                                                    |
| ---------------------------------------------- | -------------------------------------- | --------------------------------------------------------------- |
| Caminho de escrita esquecido                   | Credito no ambiente errado, silencioso | Remocao das assinaturas antigas: vira erro de compilacao        |
| Loja antiga sem conta LIVE                     | 500 no primeiro acesso LIVE            | `INSERT` na migration + teste de que toda store tem duas contas |
| Aprovar loja para LIVE sem entrada de dinheiro | Cerimonia sem efeito observavel        | Decisao da secao anterior, tomada antes da fatia 3              |
