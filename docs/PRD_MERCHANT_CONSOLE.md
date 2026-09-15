# PRD - O console do lojista

Proposta para a proxima passagem: **redesenhar o dashboard do lojista e trocar a
arquitetura dele**, no mesmo movimento e pelas mesmas razoes que levaram o admin a
sair de `features/operator` para `app/admin/` em `2026-09-09`.

Status: `proposta`. Nada aqui foi implementado.
Medido em `2026-09-15`, contra a `main` em `a5fce01` e o dashboard de pe com a loja
semeada (Cafe Figo, 1.092 pagamentos).

## 1. Por que agora

O dashboard e a maior superficie do produto e a unica que nunca foi redesenhada. A
landing virou noite em `d63f54a`, ganhou o organismo em `81c4b03`, e as telas de
entrada seguiram. A jornada hoje e: landing em carvao e osso, login em carvao e
osso, e **dashboard em creme com serifa de display** -- o sistema antigo, que a
landing abandonou.

A mesa ja resolveu esse problema uma vez. O commit `aa8a9df` diz o motivo com
todas as letras: o operador trabalhava dentro do sistema de marca do lojista. A
troca deu ao admin pasta propria, design proprio e uma costura unica. **O lojista
ficou sem nenhum dos tres.**

## 2. Diagnostico medido

### 2.1 Tamanho

| Area                        | Linhas | Observacao                                     |
| --------------------------- | ------ | ---------------------------------------------- |
| `features/dashboard/`       | 12.698 | 18 paginas (5.458 ts, 5.159 html, 2.081 css)  |
| `styles/primitives.css`     | 1.329  | classes globais, usadas pelas 18 paginas      |
| `shared/ui/`                | 1.494  | 6 componentes                                  |
| `shared/layouts/dashboard-` | 2.008  | casca, sidebar, topbar, paleta, seletor       |
| `libs/ui/` (spartan)        | 10.740 | 58 componentes, **1 em uso**                  |
| `app/admin/` (comparacao)   | 11.289 | 4 paginas, 24 componentes de ui proprios      |

### 2.2 Desenho por classe solta

As paginas montam tela combinando classe global de `primitives.css`. Contagem nos
18 templates: `panel` 215x, familia `btn` ~400x, `field`/`field-label` 93x, `stat*`
99x, `chip` 33x, `table` 32x. Zero utilitario do Tailwind.

E exatamente o quadro que `caa1174` descreveu no admin antes de corrigi-lo:
"funcionava, e nao escalava -- trocar a pele de um botao era varrer o projeto atras
de quem tinha herdado a classe dele".

### 2.3 Tres sistemas de token no mesmo arquivo

`styles.css` carrega, ao mesmo tempo:

1. os tokens do shadcn em `oklch` (`--background`, `--card`, `--sidebar`...), com um
   bloco `:root.dark` inteiro -- **e nada no dashboard liga essa classe**;
2. o sistema paper/ink do dashboard e da marca antiga;
3. o carvao/osso da landing e do auth.

Mais `admin.css`, que e substituicao e nao extensao, com `--adm-` proprio. O
dashboard e o unico que nao tem uma camada sua.

### 2.4 Spartan e dependencia morta

`libs/ui` tem 58 componentes gerados. O app importa **um**: `HlmToaster`, no layout
do dashboard. Junto dele vem `@spartan-ng/brain` (137 arquivos), `@angular/cdk`
(42), `clsx` (26), `class-variance-authority` (18), `tailwind-merge` e
`embla-carousel-angular`, que existem so para `libs/ui`. O admin ja se livrou dessa
arvore inteira em `caa1174`, com um toaster proprio de quarenta linhas.

`apexcharts` custa **900 kB** (lazy) para desenhar **uma serie de area** na visao
geral, com as cores do sistema escritas como hex literal dentro do componente e o
tooltip montado como string de HTML inline.

### 2.5 A camada de dados e pre-sinal

O app roda Angular 21.2 zoneless. A camada de dados nao acompanhou:

- **Servico como store global.** `PaymentService` guarda 10 sinais de estado de
  tela (lista, total, pagina, loading, erro, timeline). `ReceiptService` idem. E
  estado global: `PaymentService` e usado por `payments`, `payment-detail` e
  `customer-detail`; `ReceiptService` por `receipts`, `receipt-detail` e
  `customer-detail`; `FinancialService` por `financials`, `withdrawals` e
  `withdrawal-detail`. Duas telas que dividem o servico dividem o mesmo `isLoading`.
- **Erro que vira string e `console.error`.** Nenhum tipo, nenhum codigo da API.
- **Assinatura na mao.** 6 paginas implementam `OnDestroy`, 4 guardam `Subscription`,
  2 replicam o par `queryParamMap` -> `updateQueryParams` -> `parsePositiveInt`.
- **Nada usa o que o framework ja da:** `httpResource` (em `@angular/common/http`),
  `resource`/`rxResource`/`linkedSignal` (em `@angular/core`) e os formularios por
  sinal (`@angular/forms/signals`, com `form`, `schema`, `apply`, `required`) estao
  instalados e nao aparecem em nenhum arquivo.
- **Duplicacao de tela:** `shortId` reimplementado em 7 paginas, barra de filtro em
  5, `formatMoney` em 2, `toInputDate`/`addDays` na visao geral.

### 2.6 Defeito visual confirmado

`/dashboard/payments/:id` **corta conteudo em 1440px**. Medido pelo protocolo de
depuracao: a area de conteudo tem 1.168px, as colunas da grade somam 1.084px
(655 + 428), e um `.panel` da coluna direita mede 520px e termina em 1.499px. O
`.shell-scroll` fica com `scrollWidth` 1.227 contra `clientWidth` 1.168 e, como a
casca usa `overflow: hidden`, **o painel e cortado em silencio** em vez de rolar. E
por isso que "Pagador", "Cobranca de origem" e "Comprovante" aparecem com o texto
comido na captura.

### 2.7 Capacidade que existe na API e nao aparece na tela

| Rota                                 | Estado no dashboard                                    |
| ------------------------------------ | ------------------------------------------------------ |
| `POST /payments/:id/simulate/:action` | **Nao existe no front.** Zero ocorrencias.            |
| `PATCH /customers/:externalId`        | Nao existe no front: cliente e so leitura.            |
| `GET /dashboard/metrics`              | Servico tem o metodo; ninguem chama. Codigo orfao.    |
| `GET /receipts/payment/:paymentId`    | Nao chamado; o recibo so chega pela timeline.         |

A primeira e a mais cara. O produto e um **simulador dev-first**, e o lojista nao
tem um botao para forcar o desfecho de uma cobranca: confirmar, falhar, expirar e
liberar so por `curl` ou pelo link de pagamento, que tem `simulatePay`/`simulateFail`.
A promessa da landing -- "escolha o final" -- nao existe dentro do produto.

### 2.8 Portoes

`apps/web` nao tem `lint:check` nem `format:check`, entao fica fora do job `build`
da CI; so o job `web-test` roda. As 18 paginas tem 8 specs, quase todos montando a
tela com servico mockado e afirmando pouco sobre o DOM.

## 3. A proposta

### 3.1 Forma: `app/merchant/`, o irmao do `app/admin/`

Mesma decisao de `2026-09-09`, agora para o lojista: **pasta autocontida**, com ui,
dados, dominio, casca e paginas proprios.

```
app/merchant/
  merchant.routes.ts        rotas do console (loadChildren a partir de /dashboard)
  merchant.css              tokens + base; nada de componente
  domain/                   tipos, vocabulario de estado, dinheiro, ambiente
    api-contracts.ts        A COSTURA: unico arquivo que aponta para core/
  data/                     leitura (resource) e escrita (command), sem DOM
  ui/                       o design system do console, sem biblioteca de terceiro
  shell/                    rail, topbar, paleta, seletor de ambiente
  pages/                    as telas, so composicao
```

`features/dashboard/`, `shared/ui/`, `shared/layouts/dashboard-layout/` e
`libs/ui/` desaparecem ao fim da migracao. `core/` fica com o que e de verdade
compartilhado entre lojista e mesa: cliente HTTP, interceptor, guards, dinheiro.

### 3.2 Quatro camadas, uma direcao so

`domain` <- `data` <- `ui` <- `pages`. Ninguem aponta para cima:

- **domain** nao importa Angular. Sao tipos, o vocabulario de estado e as regras de
  leitura (o que e "liquido", o que e "a liberar").
- **data** importa domain. Sem DOM, sem template. Uma leitura por agregado, uma
  escrita por intencao.
- **ui** importa domain (para tom e formato). **Nao faz HTTP.** Toda peca recebe
  `input()` e emite `output()`.
- **pages** compoem: ligam um recurso de `data` a pecas de `ui`.

**Isso vira teste, e nao recomendacao.** Um spec varre os imports da pasta e falha
quando uma camada importa acima, quando `ui/` importa `data/`, ou quando qualquer
arquivo fora de `domain/api-contracts.ts` importa de fora de `merchant/`. O repo ja
tem esse idioma: `operator-read-no-secrets.spec.ts` varre rotas por reflexao na API.

### 3.3 Dados: recurso para ler, comando para escrever

Fim do servico-store global. Cada tela declara o que le:

```ts
// data/payments.ts
export function paymentsResource(query: Signal<PaymentQuery>) {
  return httpResource<PaymentPage>(() => ({ url: '/payments', params: toParams(query()) }));
}
```

O recurso ja traz `value`, `isLoading`, `error` e `reload`, refaz sozinho quando o
filtro ou o ambiente muda, e **morre com a tela** -- duas telas nunca mais dividem
`isLoading`. Escrita fica em funcao explicita, com `Idempotency-Key` onde a API
exige, devolvendo `Result` tipado (sucesso, ou o codigo de erro da API) em vez de
string solta.

**Nucleo de lista.** Um `listQuery()` amarra query param da URL <-> sinal <->
recurso, com pagina, limite, busca e periodo. As 5 barras de filtro e as 2 copias
do encanamento de paginacao viram uma peca so, e a URL continua sendo o estado
(compartilhavel, recarregavel).

**Formularios por sinal** (`@angular/forms/signals`) nos 6 formularios do console:
saque, link, produto, webhook, alerta e perfil. Validacao declarada em `schema`,
perto do dominio.

### 3.4 Desenho: o console herda a marca, sem virar a landing

O que o console **nao** e: nem a landing (que vende) nem a mesa (que julga). Ele e
onde o lojista trabalha e le dinheiro.

- **Tipografia:** Bricolage Grotesque, a voz da marca, no lugar da Instrument Serif.
  A serifa some do produto e fica na landing. Mono (JetBrains) segue em id, chave,
  evento e numero de tabela.
- **Duas peles, e o padrao e escuro.** Quem chega vem da landing e do login, os dois
  em carvao. O console abre em carvao e oferece papel, guardado por lojista, como o
  admin faz com tema e densidade. Tokens `--mer-*` em `.mer-root[data-mer-theme]`,
  nunca em `:root` -- a mesa divide a origem e nao muda de cor junto.
- **Cor so diz estado.** Confirmado, falhou, pendente, estornado. O resto e cinza
  quente. O verde e o vermelho ja existem em `--color-ok-bright`/`--color-bad-bright`.
- **O organismo continua.** A marca do console e o mesmo organismo do login, parado.
  Ele nao vira enfeite de tela cheia: aparece na casca e no **desfecho de uma
  cobranca**, que e onde ele significa alguma coisa.
- **Densidade.** A tabela do lojista hoje tem linha de 3,5rem com dois textos
  empilhados; o dinheiro pede tabela de leitura rapida, com numero tabular alinhado
  a direita e linha de 40px.

### 3.5 O que a passagem entrega de capacidade nova

Tres coisas que sao consequencia do redesign, nao enfeite:

1. **Forcar o desfecho, na tela do pagamento.** `POST /payments/:id/simulate/:action`
   ja existe: confirmar, falhar, expirar, liberar. Em TEST, sem cerimonia; em LIVE,
   a API exige loja habilitada e a tela repete o motivo. E a promessa da landing
   dentro do produto, e fecha o gap de 2.7.
2. **O detalhe do pagamento deixa de cortar conteudo** (2.6): a grade passa a ser
   `minmax(0, 1fr)` nas duas colunas, e a casca troca `overflow: hidden` por
   `clip` no eixo certo, com o painel largo caindo para baixo antes de estourar.
3. **Grafico proprio, e o `apexcharts` sai.** Uma serie de area, eixo de data e
   tooltip: ~120 linhas de SVG no vocabulario do console, contra 900 kB de
   biblioteca cujo tooltip hoje e string de HTML com hex literal dentro.

### 3.6 O que sai

| Sai                                     | Tamanho   | Por que                                              |
| --------------------------------------- | --------- | ---------------------------------------------------- |
| `libs/ui/` inteiro                      | 10.740 ln | 58 componentes, 1 em uso                            |
| `@spartan-ng/brain`, `cli`              | -         | so existe para `libs/ui`                            |
| `clsx`, `class-variance-authority`, `tailwind-merge`, `embla-carousel-angular` | - | idem |
| `ngx-sonner` + `HlmToaster`             | -         | toaster proprio, como o do admin                    |
| `apexcharts`, `ng-apexcharts`           | 900 kB    | um grafico de uma serie                             |
| `:root.dark` do shadcn e tokens `oklch` | ~60 ln    | ninguem liga a classe                               |
| `getMetrics` orfao                      | -         | codigo morto                                        |
| `primitives.css`                        | 1.329 ln  | encolhe para o que a landing usa de fato            |

`@angular/cdk` fica se alguma peca precisar de overlay; sai se nao precisar.

## 4. Fatias

Cada fatia e um PR, com testes verdes e captura de tela. Nenhuma quebra a anterior:
o console novo nasce ao lado e as rotas migram tela a tela.

| #  | Fatia                    | Entrega                                                                                     |
| -- | ------------------------ | ------------------------------------------------------------------------------------------- |
| 0  | Fundacao                 | `app/merchant/` com tokens, costura, **spec de fronteira** e casca vazia. Nenhuma tela muda. |
| 1  | Nucleo de dados          | `httpResource` + `listQuery` + comandos, provados em **Pagamentos** (a lista mais simples).  |
| 2  | Kit de ui v1             | painel, tabela, chip, campo, botao, cabecalho, estado, paginacao. Pagamentos, Comprovantes, Clientes migram. |
| 3  | Dinheiro                 | Saldo e Extrato, Saques, Detalhe do saque. Formulario de saque por sinal.                   |
| 4  | Cobranca                 | Detalhe do pagamento (**o corte morre aqui**), Links, Detalhe do link, **forcar desfecho**. |
| 5  | Integracao               | API, Webhooks, Alertas. Toaster proprio; `ngx-sonner` sai.                                  |
| 6  | Visao geral              | Grafico proprio; `apexcharts` sai.                                                          |
| 7  | Produtos, Configuracoes e limpeza | `features/dashboard/`, `shared/ui`, `libs/ui` e as dependencias saem. `lint:check`/`format:check` do web entram na CI. |

Ordem defendida: dado antes de pele (a fatia 1 prova o padrao numa tela so),
listas antes de detalhes (o kit nasce do caso comum), dinheiro antes de integracao
(e o que o lojista abre todo dia), e limpeza no fim -- enquanto uma tela antiga
existir, `primitives.css` e `shared/ui` precisam continuar de pe.

## 5. Como se prova

- **Teste de fronteira** (fatia 0): falha se uma camada importar acima, se `ui/`
  fizer HTTP, ou se alguem furar a costura.
- **Spec por tela**, ancorado em `data-test`, nao em classe -- o redesign atual
  quebraria os 8 specs existentes, que dependem de DOM.
- **Captura em 1440 e 390** por tela migrada, com a checagem de estouro horizontal
  que achou o defeito de 2.6 rodando em todas.
- **Contra a API de verdade**, com a loja semeada: cada fatia percorre suas telas
  logado, e o console fica limpo.
- **CI**: `lint:check` e `format:check` do web entram no gate na fatia 7.

## 6. O que fica fora

- **Nada de `apps/merchant` separado.** Vale a mesma decisao de `2026-09-09`: pasta
  autocontida agora, app proprio so com motivo de deploy ou de seguranca. A costura
  `domain/api-contracts.ts` e o unico arquivo que quebraria no dia.
- **Nada de mudanca de API**, com uma excecao possivel: se "forcar desfecho" exigir
  resposta melhor de erro, isso e fatia de backend propria.
- **A mesa nao e tocada.** `app/admin/` ja esta no lugar dela.
- **A landing nao e tocada**, exceto `primitives.css` encolher para o que ela usa.
- **Antifraude** (fatia 6 do PRD pai) continua em aberto e nao entra aqui.

## 7. Decisoes tomadas

Decidido em `2026-09-15`, com o usuario:

1. **Pele padrao: carvao, com papel disponivel.** O console continua a landing e o
   login, que ja sao escuros, e o papel fica como escolha do lojista -- guardada por
   lojista, como o admin guarda tema e densidade. Tokens `--mer-*` vivem em
   `.mer-root[data-mer-theme]`, nunca em `:root`: a mesa divide a origem e nao muda
   de cor junto.
2. **Escopo: redesign, arquitetura e as tres capacidades de 3.5.** Forcar o desfecho
   na tela do pagamento, o fim do corte em 1440px e o grafico proprio entram nesta
   passagem.
3. **Pasta: `app/merchant/`.** Mesmo criterio que deu `admin` ao operador -- a pasta
   leva o nome de quem entra. A rota continua `/dashboard`, como `/operator`
   continuou.
