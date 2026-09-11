# Hockpay - Goal (arquivada)

Arquivada em `2026-09-10`. Nao ha goal ativa; a proxima esta em aberto em `/GOAL.md`.

Source repo: `/Users/jpcass/Documents/2026/hockpay`
Last reviewed: `2026-09-10`
Ordering: leitura antes de escrita; rota antes de tela; saque antes de estorno
Scope: a mesa saca e estorna pela loja **pela tela**, e nao mais por `curl`
Status final: `concluido`. Validado contra a API de verdade; o passo clicando pela tela continua aberto, pelo mesmo motivo de `2026-09-08`: o repo nao tem automacao de browser

A passagem de `2026-09-09` fechou o backend -- a mesa ganhou as rotas de saque e
estorno pela loja -- e deixou a tela de fora por escopo. Um chamado de retirada de
loja suspensa se resolvia por `curl`. Esta passagem foi a tela, e uma leitura que a
tela nao tinha como dispensar.

## O que entrou

| Commit    | Entrega                                                                          |
| --------- | -------------------------------------------------------------------------------- |
| `12d04bf` | `GET /operator/stores/:id/bank-accounts`: a mesa le os destinos Pix da loja      |
| `ed5387f` | Saque e estorno pela loja na tela da investigacao, com a chave presa a intencao  |

## Decisoes que valem para as proximas fatias

- **Leitura antes de escrita.** A rota de saque exige `bankAccountId`, e nenhuma
  leitura de operador devolvia destino. Sem a leitura, a tela pediria um id colado de
  fora -- `curl` com botao. A leitura nova segue as outras: reusa o use case do
  lojista, devolve a forma que ele recebe, nao pede ambiente (destino e da loja, nao
  do ledger) e nao grava na trilha.
- **Chave Pix e documento do titular nao sao credencial.** Sao para onde o dinheiro
  vai, e escolher destino sem eles e escolher no escuro. A varredura de segredos
  passou a mockar a rota nova e continua procurando o que a loja usa para se
  autenticar.
- **A chave de idempotencia e da intencao, e nao do clique nem do painel.** Presa a
  impressao digital do pedido (rota e corpo): mesmo pedido reenviado leva a mesma
  chave, inclusive depois de fechar e reabrir o painel; pedido diferente leva chave
  nova; sucesso descarta. A validacao confirmou por que as duas pontas importam:
  mesma chave com corpo diferente volta `409 IDEMPOTENCY_KEY_CONFLICT`, entao chave
  por painel faria a correcao de um valor digitado errado dar erro, e chave por
  clique faria a resposta perdida virar segundo saque.
- **O ambiente nao se escolhe no painel.** Vem da investigacao, que e onde o saldo
  foi lido; trocar de ambiente, de aba ou de loja fecha o painel aberto. Sacar de um
  ledger diferente do que esta na tela seria decidir com um numero e mover outro.
- **Dois passos, e o segundo repete em prosa.** Quanto sai, de qual ledger, para qual
  chave, com qual taxa e qual liquido; o botao final carrega o valor e o ambiente.
- **O saque mora na aba de saldo; o estorno, na linha do tempo do pagamento.** Cada
  um onde a mesa ja esta quando descobre que precisa dele.
- **Reais sao lidos por texto, e estrito.** `10.50` e recusado em vez de lido como
  milhar; a conversao nao multiplica ponto flutuante. O parser mora em
  `admin/domain/money.ts`, e nao e o do lojista -- ver achados.
- **A politica de saque e copia.** Taxa de 199 centavos e faixa de 10 a 5.000 reais,
  as mesmas do painel do lojista. A tela avisa antes; quem decide e a API, e a tela
  mostra a mensagem dela quando os dois divergirem.
- **A mesa nao cadastra destino pela loja.** Sem destino verificado, a tela diz isso
  em vez de um select vazio.

## Achados que mudaram o plano

- **O parser de reais do painel do lojista le `10.50` como R$ 1.050,00.** Ele trata
  `.` como separador de milhar e converte por `Math.round(valor * 100)`. Esta copiado
  em quatro paginas (`products`, `payment-links`, `withdrawals`, `payment-detail`).
  Nao foi reusado aqui, e nao foi corrigido la: e achado aberto, sem dono.
- **Estorno parcial nao muda o status do pagamento.** Ele continua `CONFIRMED` ou
  `RELEASED` e so vira `REFUNDED` quando o estornado cobre o total. O botao de
  estorno depende do estornavel restante, e nao so do status.
- **`PaymentStatus` do web e enum.** A costura `api-contracts.ts` passou a exporta-lo
  como valor, e nao so como tipo.

## Validacao

Script descartavel contra a API desta branch e o banco de dev -- **21 assercoes, 0
falhas**. Lojista, loja, dois pagamentos TEST (um liberado, um so confirmado),
destino Pix verificado e um operador proprio, criados pelo proprio script:

- a leitura de destinos responde sem ambiente, com a mesma forma do lojista, e
  recusa sessao de lojista;
- o saque bloqueia 5.000 do disponivel com taxa de 199 e liquido de 4.801;
- a mesma chave com o mesmo corpo e replay (`x-idempotency-replayed: true`, mesmo
  saque, saldo intacto); com corpo diferente e `409`; sem chave e `400`;
- o estorno de pagamento confirmado sai do "a liberar", menos a taxa devolvida, e o
  pagamento continua `CONFIRMED`; ambiente divergente e `LIVE_ENVIRONMENT_NOT_ALLOWED`;
  acima do estornavel e recusado;
- a trilha tem uma linha de saque e uma de estorno, com motivo e antes/depois, e a
  leitura de destinos nao grava nada.

## O que fica aberto

- **Passo pela tela, clicando.** Os testes de tela cobrem o fluxo contra HTTP
  mockado, e a validacao cobre as rotas contra a API de verdade; ninguem clicou os
  dois juntos ainda.
- **Nenhum smoke cobre a mesa.** O script desta validacao e o esqueleto de um
  `smoke:operator` -- e continua descartavel.
- **Listagem de saques na mesa.** O extrato mostra a reserva e o toast da o id; uma
  aba de saques e passagem propria se o chamado pedir.
