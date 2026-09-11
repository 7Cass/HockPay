# Hockpay - Goal

Source repo: `/Users/jpcass/Documents/2026/hockpay`
Last reviewed: `2026-09-10`
Ordering: leitura antes de escrita; rota antes de tela; saque antes de estorno
Scope: a mesa saca e estorna pela loja **pela tela**, e nao mais por `curl`
Status: `em andamento`

A passagem de `2026-09-09` (arquivada em `docs/goals/2026-09-09-suspended-store-money.md`)
fechou o backend: loja sem habilitacao LIVE parou de sacar e de estornar por conta
propria, e a mesa ganhou `POST /operator/stores/:id/withdrawals` e `/refunds`, com
motivo, trilha e idempotencia. A tela ficou de fora por escopo, e um chamado de
retirada de loja suspensa se resolve hoje por `curl`.

O argumento e o mesmo que justificou a passagem de `2026-09-08`: capacidade que so
existe por `curl` e capacidade que ninguem opera. O design system do admin (#15)
entrou depois dessa decisao, e ja tem as pecas de que esta tela precisa -- `sheet`,
`field`, `button`, `notice`, `toast`.

## O que falta, de verdade

Nao e so tela. **A mesa nao tem como escolher o destino do saque.** A rota exige
`bankAccountId`, e nenhuma leitura de operador devolve os destinos Pix da loja: as
seis sub-leituras sao pagamentos, linha do tempo, conta, extrato, webhooks e
entregas. Sem uma leitura nova, a tela teria de pedir um id colado de fora -- que e o
`curl` com botao.

## Fatias

| Fatia | Estado         | Entrega                                                                          |
| ----- | -------------- | -------------------------------------------------------------------------------- |
| P0    | `nao iniciado` | `GET /operator/stores/:id/bank-accounts`, pura, no molde das outras sub-leituras |
| P1    | `nao iniciado` | Servico de dinheiro no admin, com a chave de idempotencia presa a intencao       |
| P2    | `nao iniciado` | Saque pela loja, na aba "Saldo e extrato" da investigacao                        |
| P3    | `nao iniciado` | Estorno pela loja, a partir da linha do tempo do pagamento                       |
| P4    | `nao iniciado` | `CURRENT_STATE`, validacao contra a API de verdade e arquivamento                |

### P0 -- A leitura dos destinos

- `GET /operator/stores/:id/bank-accounts` reusa `ListBankAccountsUseCase` e
  serializa por `BankAccountResponseDto.fromUsageList`, a mesma forma que o lojista
  recebe. Nao existe leitura paralela, pela razao da fatia 5.
- Sem `environment`: `BankAccount` e escopado por loja e nao tem coluna de ambiente,
  e pedir um parametro que a rota ignora e a mentira pequena que `webhooks` ja evita.
- Pura: nao grava na trilha. Quem entra na loja ja gravou `store.investigated`.
- A varredura `operator-read-no-secrets.spec.ts` pega a rota sozinha, por reflexao, e
  precisa de um mock de `listBankAccountsUseCase` para chegar a forma da resposta.

### P1 -- O servico

- Servico proprio no admin (`operator-money.service.ts`), e nao metodos a mais na
  investigacao: o backend separou o controller de dinheiro por custo, e a tela segue.
- Os tipos (`BankAccount`, `Withdrawal`, `RefundObject`) passam pela costura
  `domain/api-contracts.ts`, e por nenhum outro lugar.
- **A chave de idempotencia e da intencao, e nao do clique nem da abertura do
  painel.** Ela e presa a impressao digital do corpo (loja, ambiente, destino ou
  pagamento, valor, motivo): mesmo corpo reenviado leva a mesma chave, inclusive
  depois de fechar e reabrir o painel; corpo diferente leva chave nova; sucesso
  descarta. Chave nova por abertura deixaria a mesa sacar duas vezes quando a
  resposta se perde; chave unica por painel faria a API recusar a correcao de um
  valor digitado errado.

### P2 -- O saque

- Mora na aba "Saldo e extrato": o saldo do ambiente ja esta na frente de quem
  decide, e o ambiente e o que o seletor da investigacao ja mostra.
- Painel central, em dois passos: preencher e **confirmar**. A confirmacao repete em
  prosa o que vai acontecer -- quanto sai, de qual ledger, para qual chave, com qual
  taxa e qual liquido -- e o botao carrega o valor e o ambiente.
- Destinos nao verificados aparecem e nao sao escolhiveis, com a razao; lista vazia
  diz que a loja nao tem destino, em vez de um select em branco.
- Valor em reais, convertido para centavos por texto e nunca por multiplicacao de
  ponto flutuante. Faixa e taxa vem da mesma politica que o lojista ve; a tela avisa
  antes, a API decide.
- Sucesso recarrega conta e extrato, e diz o id do saque e que a trilha registrou.

### P3 -- O estorno

- Entra pela linha do tempo do pagamento, que ja e onde a mesa investiga um
  pagamento. So aparece para `CONFIRMED` e `RELEASED` com saldo estornavel.
- O valor comeca no estornavel restante (`amount - totalRefunded`). A tela diz de
  onde o dinheiro sai: `pending` se o pagamento ainda nao liberou, `available` se ja.
- `environment` vai como o ambiente investigado, que e conferencia e nao instrucao: a
  API recusa se ele divergir do pagamento.
- Mesmo painel em dois passos e mesma regra de chave do saque.

### P4 -- Fechamento

- `CURRENT_STATE`: a lacuna "A via da mesa nao tem tela" fecha; a trilha registra
  nove acoes, e nao sete; a matriz de superficies ganha a leitura de destinos.
- Validacao contra a API de verdade, com operador, loja com saldo e os dois
  movimentos, conferindo a trilha e o ledger depois. Nenhuma tela da mesa foi
  exercitada assim ainda.

## Fica fora

- Listagem de saques da loja na mesa. O extrato ja mostra `WITHDRAWAL_RESERVED`, e a
  confirmacao diz o id; uma aba de saques e passagem propria se o chamado pedir.
- Papeis dentro do operador, limite por operador ou aprovacao em dois. A mesa continua
  sem papeis, e a trilha e o controle.
- Smoke dedicado da mesa (opcao B da escolha anterior).

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

## Passagens anteriores

- `docs/goals/2026-08-18-architecture-hardening.md`
- `docs/goals/2026-08-18-workspace-honesty-and-integrity.md`
- `docs/goals/2026-08-19-leftover-authz-and-read-isolation.md`
- `docs/goals/2026-08-19-test-live-identity-isolation.md`
- `docs/goals/2026-09-06-operator-boundary-and-environment-ledger.md`
- `docs/goals/2026-09-07-live-onboarding.md`
- `docs/goals/2026-09-08-operator-desk-and-environment-selector.md`
- `docs/goals/2026-09-09-suspended-store-money.md`
