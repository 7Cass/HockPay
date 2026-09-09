# Hockpay - Goal

Source repo: `/Users/jpcass/Documents/2026/hockpay`
Last reviewed: `2026-09-09`
Ordering: o gate e a via andam juntos; dominio antes de rota; rota antes de tela
Scope: **loja suspensa nao movimenta dinheiro por conta propria, e a mesa movimenta por ela**
Status: `em andamento`

A decisao de produto ja estava tomada e escrita em `2026-09-08` (`PRODUCT.md`, e a
lacuna no `CURRENT_STATE`): suspensao fecha a movimentacao financeira do lojista em
LIVE, nao so a cobranca. O saldo continua sendo dele; o que muda e quem executa.

Esta passagem e a **correcao do comportamento**, nao capacidade nova. Hoje
`create-payment`, `create-payment-link` e `create-checkout-session` releem a loja na
chamada e recusam LIVE sem habilitacao; `create-withdrawal` so checa `isActive`, e
`create-refund` nao le a loja de jeito nenhum. Dinheiro nao entra e sai.

## As duas metades

Ela precisa das duas, e a razao esta escrita no commit `22ab5fc`: so o gate deixaria
o saldo LIVE de uma loja suspensa **sem saida nenhuma**, e uma porta trancada sem
chave e o inverso da "porta para sala vazia" que a fatia 3 evitou.

| Passo | Entrega                                                                    |
| ----- | -------------------------------------------------------------------------- |
| P0    | O gate: saque e estorno recusam LIVE em loja nao habilitada                |
| P1    | A mesa saca pela loja -- use case, rota, trilha e idempotencia             |
| P2    | A mesa estorna pela loja, pelo mesmo caminho                               |
| P3    | Doc: fechar a lacuna no `CURRENT_STATE`, e o `PRODUCT` deixa de prometer   |

## Decisoes desta passagem

- **O gate e o que ja existe, nao um gate de suspensao.** `assertLiveEnvironmentEnabled`
  ja e "a unica regra que fecha LIVE para operacao iniciada pelo chamador", e vale
  para os tres caminhos de entrada de dinheiro. Saque e estorno entram nela. Um
  segundo predicado -- "esta suspensa?" -- seria um segundo lugar onde a regra pode
  divergir, e divergiria: `SUSPENDED` nao e o unico estado sem habilitacao.
- **A regra e reler a loja na chamada, e nao confiar no token.** E o que o achado
  aberto do `GOAL` anterior determinou: nada revoga um access token em voo, entao a
  suspensao so vale se o caminho que move dinheiro consultar a loja no momento em que
  move. `create-payment` ja fazia; e por isso que a janela de 15 minutos existia so
  para o saque.
- **Estorno passa a ler a loja, e so em LIVE.** Ele nao lia nenhuma. A leitura extra
  fica atras do `environment !== LIVE`, como `assertLiveSimulationAllowed` ja faz --
  TEST nao paga por uma regra que so existe em LIVE.
- **O ambiente do estorno e o do pagamento, nao o da request.** Isso ja valia para o
  ledger; passa a valer para o gate, pela mesma razao: quem manda e o dinheiro que
  esta sendo devolvido.
- **A mesa nao ganha um caminho paralelo de dinheiro.** As duas rotas novas chamam
  `CreateWithdrawalUseCase` e `CreateRefundUseCase` -- os mesmos do lojista -- dentro
  da transacao onde a trilha e escrita. Um segundo caminho para o ledger teria a
  propria nocao de limite, taxa e saldo, e as duas divergiriam na primeira mudanca.
- **A escapatoria e explicita e do chamador.** `operatorInitiated` no input, no mesmo
  molde do `systemInitiated` que o job de liquidacao e a fila de expiracao ja usam.
  Fail closed: quem nao diz quem e, nao passa.
- **O caminho do sistema continua livre.** `complete-withdrawal`, `fail-withdrawal` e
  `mark-withdrawal-processing` nao ganham gate: fechar o saque ja reservado deixaria
  dinheiro LIVE presos em `blocked` para sempre, que e pior do que a suspensao tenta
  evitar. Mesma razao que a liquidacao e a expiracao ja tinham.
- **Motivo obrigatorio, checado no use case.** Como nas outras duas mutacoes da mesa:
  um cliente HTTP direto nao passa pela tela, e a regra de auditoria e do dominio.
- **A trilha guarda saldo antes e depois.** `targetType: 'store'`, como as outras tres
  acoes, porque a mesa raciocina por loja e a trilha nao filtra por alvo. A identidade
  do saque/estorno vai no `after`.

## Fora do escopo, e por que

- **A tela da mesa.** As rotas ficam operaveis por HTTP; a superficie de "mover
  dinheiro pela loja" e a proxima passagem. O `CURRENT_STATE` registra isso como
  lacuna aberta, e nao como pronto.
- **Revogar a sessao do lojista na suspensao.** Continua achado aberto. Com o gate no
  lugar, ele deixa de custar dinheiro: a sessao sobrevive, mas nao move nada.

## Passagens anteriores

- `docs/goals/2026-08-18-architecture-hardening.md`
- `docs/goals/2026-08-18-workspace-honesty-and-integrity.md`
- `docs/goals/2026-08-19-leftover-authz-and-read-isolation.md`
- `docs/goals/2026-08-19-test-live-identity-isolation.md`
- `docs/goals/2026-09-06-operator-boundary-and-environment-ledger.md`
- `docs/goals/2026-09-07-live-onboarding.md`
- `docs/goals/2026-09-08-operator-desk-and-environment-selector.md`
