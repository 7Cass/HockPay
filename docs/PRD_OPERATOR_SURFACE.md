# PRD - Superficie de operador

> **Status: proposta. Nada descrito aqui existe no runtime.**
> Este documento define uma superficie que ainda nao foi construida. Ele nao
> descreve o sistema atual -- para isso, [CURRENT_STATE.md](CURRENT_STATE.md).
> Enquanto a Matriz de Maturidade nao tiver as linhas correspondentes como
> `Implementado`, tudo abaixo e intencao.

Last reviewed: `2026-09-05`
Depende de: isolamento de ledger por ambiente (ver [Dependencia dura](#dependencia-dura-ledger-por-ambiente))

## Por que este documento existe

O [PRODUCT.md](PRODUCT.md) descreve quatro personas, e todas sao de integrador:
dev indie, startup pequena, estudante/mentor e builder de demo. Todas usam o
hockpay pelo lado de fora -- criam conta, cobram, recebem webhook.

Nenhum gateway funciona so com esse lado. Existe uma mesa interna que aprova
lojista, ajusta taxa, investiga chamado e revisa risco. O hockpay nao tem essa
superficie, e tambem nao tem nenhuma fronteira de autorizacao: hoje todo usuario
autenticado e merchant e enxerga apenas as proprias lojas. Nao existe papel, nao
existe usuario interno, nao existe trilha de auditoria.

Este PRD existe porque decisoes de autorizacao sao caras de reverter. Um modelo
errado de principal contamina guard, token, query e migration, e sai muito mais
caro depois do que antes.

## O ponto de produto que justifica a superficie

O objetivo declarado do projeto e ser um **simulador crivel de gateway**. Isso
muda o argumento de "toda empresa precisa de back-office" para algo mais
especifico:

Um estudante que so ve o lado do lojista aprende metade do que um gateway e. Ele
nunca descobre que existe uma mesa de risco, que taxa e negociada por lojista,
que aprovacao para producao e diferente de criar conta, ou que toda acao interna
deixa rastro. **A superficie de operador nao e so ferramenta interna: e parte do
que o simulador ensina.**

E o criterio de escopo que vem junto: entra o que um integrador precisa
_entender_ sobre como um gateway opera. Fica de fora o que so faz sentido com
dinheiro real ou obrigacao regulatoria.

## Persona: operador

| Aspecto      | Descricao                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Quem e       | Quem opera a instancia do hockpay. Num simulador local, e a mesma pessoa que integra -- mas atuando por outra porta, com outro conjunto de poderes.     |
| O que precisa| Aprovar loja para producao, ajustar condicao comercial, investigar um caso especifico atravessando lojas, e revisar o que o motor de risco sinalizou.  |
| O que teme   | Fazer uma mudanca com consequencia financeira sem conseguir explicar depois quem fez, quando e por que.                                                 |
| Como aprende | Ver, na propria ferramenta, o formato de decisao que um gateway real toma -- inclusive as que ele **nao** pode tomar.                                   |

## Modelo de autorizacao

### Operador nao e merchant com flag

O operador precisa ser um **principal separado**, com tabela propria, caminho de
autenticacao proprio e token de audiencia propria.

A alternativa tentadora -- uma coluna `role` em `Merchant` -- e um erro estrutural.
Com ela, um merchant comprometido fica a um `UPDATE` de acesso total a plataforma,
e toda query passa a depender de alguem lembrar de filtrar. Com principais
separados, a fronteira e estrutural: um token de merchant simplesmente nao e
aceito numa rota de operador, sem condicional nenhuma no meio.

Requisitos:

- Tabela propria (`Operator`), sem relacao com `Merchant`.
- Login em caminho proprio. Token carrega a audiencia; o guard rejeita audiencia
  errada antes de olhar qualquer permissao.
- Um token nunca serve para os dois lados. Nao existe elevacao de merchant para
  operador.
- Provisionamento por CLI/seed, nao por cadastro publico. Num simulador nao
  existe fluxo de "contratar funcionario"; existe `pnpm operator:create`.

### Papeis de merchant ficam fora deste PRD

Gateways reais tambem tem papeis _dentro_ do lojista -- dono, desenvolvedor,
analista. Isso e uma segunda fronteira, com produto proprio, e nao e
pre-requisito de nada aqui. Fica para PRD proprio.

## O que o operador pode

| Poder                              | Escopo                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| Aprovar/rejeitar loja para LIVE    | Muda o estado de habilitacao de producao. Nao afeta TEST.                            |
| Suspender loja                     | Interrompe cobranca nova sem apagar historico.                                       |
| Ajustar taxa e prazo               | `feePercent`, `feeFixed`, `settlementDays`. Vale para cobranca futura.               |
| Ler dados de qualquer loja         | Payments, ledger, webhooks e timeline, para investigar chamado.                      |
| Revisar alerta de risco            | Marcar como procedente ou falso positivo (quando o motor existir).                   |

## O que o operador nao pode

Esta lista importa tanto quanto a de cima, e e o que separa uma ferramenta
crivel de um backdoor com tela.

- **Nao move dinheiro.** Sem ajuste manual de saldo, sem credito, sem estorno
  discricionario. Toda alteracao de saldo continua vindo de um fato do dominio
  (pagamento, estorno, saque). Um botao de "ajustar saldo" transformaria o ledger
  em algo que nao se pode auditar, e o projeto inteiro e construido no oposto disso.
- **Nao le segredo.** Secret de webhook e chave de API continuam invisiveis,
  inclusive para operador. Suporte investiga entrega e log, nao credencial.
- **Nao age sem rastro.** Nao existe acao de operador fora da trilha de auditoria.
- **Nao se autentica como merchant.** Impersonacao ("ver como a loja") fica fora
  desta fase: e util e e comum em gateways reais, mas exige um modelo de consentimento
  e de rastro que merece decisao propria.
- **Nao muda taxa retroativamente.** `Payment.fee` ja e snapshot no momento da
  cobranca. Mudanca de condicao comercial vale para o futuro, e o passado
  permanece explicavel.

## Trilha de auditoria

Pre-requisito de qualquer poder acima, e nao acabamento posterior. Construir
poder antes de rastro produz um sistema **menos** crivel do que o atual: hoje
ninguem pode mudar a taxa de uma loja, o que e melhor do que alguem poder mudar
sem registro.

Cada registro guarda: operador, acao, tipo e id do alvo, estado antes, estado
depois, motivo (texto livre, obrigatorio nas acoes com consequencia financeira),
`requestId` e carimbo de tempo.

- Append-only. A interface de repositorio nao expoe update nem delete.
- Visivel na propria superficie de operador. Trilha que so existe no banco nao e
  trilha, e log.
- Escrita na mesma transacao da mudanca que descreve. Auditoria que pode falhar
  sozinha registra uma historia diferente da que aconteceu.

## Onboarding: TEST livre, LIVE pela mesa

O instinto e tratar "loja aprovada automaticamente" como o furo a corrigir. Nao
e -- pelo menos nao do jeito obvio. Gateways de verdade deixam integrar e cobrar
em TEST **imediatamente**, e exigem aprovacao apenas para producao. Fricção no
cadastro seria produto pior e simulacao menos fiel ao mesmo tempo.

O modelo, entao, nao e "aprovar a loja". E **habilitar a loja para LIVE**:

| Estado          | Significado                                                        |
| --------------- | ------------------------------------------------------------------ |
| `NOT_REQUESTED` | Loja existe e opera em TEST. Estado inicial de toda loja.           |
| `PENDING`       | Lojista pediu habilitacao para producao. Aguarda a mesa.            |
| `APPROVED`      | Pode operar em LIVE.                                                |
| `REJECTED`      | Pedido recusado, com motivo registrado.                             |
| `SUSPENDED`     | Habilitacao revogada depois de concedida.                           |

TEST funciona em todos os estados. Isso mantem a promessa do produto -- "reduzir
o tempo ate o primeiro pagamento" -- intacta, e ainda ensina a distincao real.

## Dependencia dura: ledger por ambiente

**Onboarding LIVE nao pode ser construido antes do isolamento de ledger por
ambiente.**

Hoje `Account` nao tem coluna de ambiente, e o CURRENT_STATE registra que uma key
TEST ainda simula no saldo da loja. Enquanto isso for verdade, aprovar uma loja
para LIVE nao significa nada: o dinheiro simulado e o "real" estao no mesmo lugar,
e a mesa estaria concedendo acesso a producao sobre um saldo contaminado por
simulacao.

Esse item ja estava no roteiro como passagem estrutural. Ele deixa de ser o item
mais distante e vira pre-requisito da coisa que estamos construindo.

## Onde o antifraude entra

O motor de risco foi removido do runtime em `2026-09-04` porque era stub, e esta
registrado como `Planejado`. Ele volta **como modulo no monolito**, nao como
servico separado.

A razao e o objetivo do projeto: ninguem usando o sandbox consegue perceber se o
scoring roda no mesmo processo ou atras de HTTP. A separacao seria invisivel
justamente para quem o produto serve, e cobraria deploy, contrato entre servicos
e um segundo lugar onde a transacao pode falhar pela metade.

A ressalva honesta: existe um ponto em que separar se paga, que e a parte
_sincrona_ do risco -- a que fica dentro do caminho da autorizacao, com orcamento
de milissegundos e cadencia de release propria. O hockpay nao tem isso hoje. Se
tiver, a decisao se reabre.

E a ordem importa: o motor entra **depois** da fila de revisao existir. Alerta
sem consumidor e a mesma capacidade fantasma que acabou de ser removida.

## Nao-objetivos

- **Microsservico.** Ver secao acima.
- **KYC de verdade.** Sem upload de documento, sem verificacao de identidade, sem
  consulta a lista de sancoes. O simulador pode representar os _estados_ de uma
  analise sem fingir que faz a analise.
- **Chargeback e disputa.** Exigem trilhos de cartao, que o hockpay nao simula.
- **Papeis dentro do merchant.** PRD proprio.
- **Impersonacao.** Adiada por decisao, nao por esquecimento.
- **Dinheiro real.** Continua valendo para tudo.

## Ordem de construcao

1. **Fronteira de autorizacao** -- principal `Operator`, autenticacao propria,
   trilha de auditoria. Nada de poder ainda. Detalhado em
   [PRD_OPERATOR_AUTHZ.md](PRD_OPERATOR_AUTHZ.md).
2. **Ledger por ambiente** -- pre-requisito do passo 3.
3. **Onboarding LIVE** -- estados de habilitacao e a mesa que decide.
4. **Condicao comercial** -- taxa e prazo, auditados.
5. **Visao cross-merchant** -- leitura para investigar chamado.
6. **Antifraude como modulo** -- alimentando a fila de revisao.

Cada passo e entregavel sozinho. Os passos 1 e 2 nao produzem tela nova; produzem
a base sem a qual os outros quatro seriam construidos errado.

## Criterios de aceite

- Um token de merchant recebe 401 em qualquer rota de operador, e vice-versa,
  verificado por teste e nao por inspecao.
- Nenhuma acao de operador existe sem registro correspondente na trilha, e a
  trilha nao tem caminho de escrita que nao seja append.
- Uma loja recem-criada cobra em TEST sem passar por aprovacao nenhuma.
- Uma loja sem habilitacao LIVE nao consegue cobrar em LIVE, e a recusa e erro de
  dominio, nao 500.
- Mudanca de taxa nao altera o valor de nenhum pagamento ja existente.
- Nenhuma tela de operador expoe secret de webhook ou chave de API.
- O CURRENT_STATE descreve a superficie com seus limites, e a Matriz de Maturidade
  ganha as linhas correspondentes com status honesto.
