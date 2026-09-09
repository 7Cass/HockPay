# Hockpay - Goal (arquivada)

Arquivada em `2026-09-09`. Nao ha goal ativa; a proxima esta em aberto em `/GOAL.md`.

Source repo: `/Users/jpcass/Documents/2026/hockpay`
Last reviewed: `2026-09-09`
Ordering: o gate e a via andam juntos; dominio antes de rota; rota antes de tela
Scope: loja suspensa nao movimenta dinheiro por conta propria, e a mesa movimenta por ela
Status final: `concluido` no backend. A tela da mesa para mover dinheiro nao foi feita, por decisao de escopo, e esta escrita como lacuna aberta no `CURRENT_STATE`

Esta passagem nao acrescentou capacidade: **corrigiu comportamento**. A decisao de
produto ja estava tomada e escrita em `2026-09-08` (`22ab5fc`), e o que faltava era
o codigo. O defeito era caro e simetricamente errado -- `create-payment` recusava
LIVE em loja suspensa, `create-withdrawal` nao. **Dinheiro nao entrava e saia.**

## O que entrou

| Commit    | Entrega                                                                     |
| --------- | --------------------------------------------------------------------------- |
| `d4b4f9a` | O gate: saque e estorno recusam LIVE em loja nao habilitada                 |
| `4e43e16` | A mesa saca e estorna pela loja, com motivo, trilha e idempotencia          |

## Decisoes que valem para as proximas fatias

- **Caminho que move dinheiro rele a loja na chamada.** Esta era a regra deixada em
  aberto pelo achado "nada revoga um access token em voo", e agora ela e o desenho:
  a suspensao so vale se quem move o dinheiro perguntar a loja no momento em que
  move. Confiar no token e o que criava a janela de 15 minutos.
- **O gate e um so, e ja existia.** `assertLiveEnvironmentEnabled` passou a valer
  para os cinco caminhos de dinheiro, e nao so para os tres de entrada. Um predicado
  novo de "esta suspensa?" seria um segundo lugar de onde a regra diverge -- e
  divergiria, porque `SUSPENDED` nao e o unico estado sem habilitacao.
- **A leitura extra fica atras do LIVE.** `assertLiveEnvironmentEnabledById` so le a
  loja quando o ambiente e LIVE. TEST nao paga por uma regra que so existe em LIVE,
  e esse ja era o formato de `assertLiveSimulationAllowed`.
- **O caminho do sistema continua isento.** Liquidacao, expiracao e o fechamento de
  saque movem dinheiro que a loja ja criou legitimamente. Fecha-los deixaria saldo
  LIVE preso em `pending` ou `blocked` para sempre, que e pior do que a suspensao
  tenta evitar. Mesma razao que ja isentava os dois primeiros.
- **A escapatoria e explicita e do chamador.** `operatorInitiated`, no molde do
  `systemInitiated`. Fail closed: quem nao diz quem e, nao passa.
- **A mesa nao ganha caminho paralelo para o ledger.** As duas rotas novas chamam os
  use cases do proprio lojista dentro da transacao onde a trilha e escrita. Foi a
  mesma escolha da fatia 5 para leitura, pela mesma razao: um segundo caminho teria
  a propria nocao de limite, taxa e saldo, e os dois divergiriam.
- **A trilha le o "antes" travado.** A leitura solta poderia enxergar uma versao
  anterior a que o movimento altera, e a linha registraria um saldo de onde o
  dinheiro nunca saiu. Vale para qualquer acao de mesa que grave antes/depois de um
  valor que ela propria muda.
- **`environment` na rota de estorno e conferencia, nao instrucao.** Quem sabe o
  ledger e o pagamento. O campo existe para **recusar** a divergencia -- a mesa
  investiga muitas lojas nos dois ledgers, e "eu queria o outro" e o engano que ele
  pega. Ler o ambiente da request e *segui-lo* seria o erro; ler e *conferir* e a
  protecao.
- **O controller de dinheiro e proprio.** `OperatorStoreController` decide *sobre* a
  loja e nao toca no ledger; tudo que toca paga idempotencia e trilha, e mora
  separado. A divisao e por custo, nao por assunto.
- **Rota de operador nao usa `@Idempotent()`.** O interceptor tira a loja da sessao
  de merchant que a requisicao nao tem, e recusaria tudo com
  `IDEMPOTENCY_STORE_REQUIRED`. A reserva e feita no controller, escopada na loja
  pela qual a mesa age -- o escopo certo de qualquer jeito.
- **A mesa nao checa se a loja esta suspensa antes de sacar por ela.** Sacar por uma
  loja aberta, por chamado, e suporte legitimo; e o saldo e a restricao real, porque
  loja que nunca alcancou LIVE nao tem dinheiro LIVE para tirar.

## Achados que mudaram o plano

- **O worktree nasceu de `origin/main`, nove commits atras da `main` local.** Todo o
  P0 foi escrito contra uma arvore que nao tinha o seletor de ambiente nem o ledger
  LIVE de saque. O rebase revelou que `create-withdrawal` e `create-refund` eram
  identicos nas duas pontas -- o gate estava certo --, mas dois testes e um fixture
  nao estavam. Vale a conferencia antes, e nao depois.
- **Dois testes contavam uma historia que o gate tornou impossivel.** O da simulacao
  LIVE criava o saque com a loja **ja suspensa**, o que agora nao acontece mais em
  lugar nenhum. Ele passou a criar com a loja aberta e suspender depois -- a unica
  sequencia real, e uma historia melhor do que a que ele contava. O de estorno tinha
  `storeRepository: {}`, que bastava enquanto o estorno nao lia loja nenhuma.
- **O fixture de saque mentia, e a `main` ja tinha corrigido.** Ele passava
  `isLiveEnabled: () => true` dentro de `Store.reconstitute`, que nunca leu essa
  prop. Foi encontrado duas vezes de forma independente, o que diz algo sobre o
  custo de um fixture que afirma o que a entidade nao confirma.
- **`create-refund` nao lia a loja de jeito nenhum.** O gate do saque era so um `if`
  a mais numa funcao que ja tinha a loja na mao; o do estorno exigiu uma leitura que
  nao existia. A assimetria estava escondida atras de "os dois sao JWT-only".

## O que fica aberto

- **A tela da mesa para mover dinheiro.** As rotas sao operaveis por HTTP e nao tem
  superficie em `apps/web`. E o mesmo lugar onde a fatia 3 deixou a mesa inteira
  antes da passagem de `2026-09-08`, e o mesmo argumento se aplica: capacidade que
  so existe por `curl` e capacidade que ninguem opera.
- **Nada revoga um access token em voo.** Continua verdade, e continua consequencia
  de D1/D2 do PRD do seletor. O que mudou e o preco: a sessao sobrevive a suspensao,
  mas nao move mais dinheiro.
- **Nenhum smoke cobre as duas superficies novas.** O `GOAL` anterior ja apontava a
  falta de `smoke:operator` e `smoke:environment`; agora ha uma terceira coisa nao
  coberta por smoke, e ela escreve no ledger.
