# Hockpay - Goal

Source repo: `/Users/jpcass/Documents/2026/hockpay`
Last reviewed: `2026-09-16`
Ordering: fronteira antes de codigo; dado antes de pele; lista antes de detalhe; limpeza no fim
Scope: **o console do lojista** -- `app/merchant/`, com arquitetura, desenho e as tres capacidades que o redesign destrava
Status: `em andamento`. PRD em `docs/PRD_MERCHANT_CONSOLE.md`; fatias 0 a 5 concluidas

O dashboard e a maior superficie do produto (12.698 linhas, 18 telas) e a unica que
nunca foi redesenhada. A landing virou noite, as telas de entrada seguiram, e o
lojista continua em creme com serifa -- o sistema que a marca abandonou. A mesa ja
resolveu esse problema uma vez, em `2026-09-09`, saindo do sistema de marca do
lojista para `app/admin/`. Esta passagem faz o mesmo pelo lojista, e aproveita para
trocar a camada de dados, que e pre-sinal num app Angular 21 zoneless.

## Fatias

| #   | Fatia                             | Estado         | Entrega                                                                                                          |
| --- | --------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------- |
| 0   | Fundacao                          | `concluido`    | `app/merchant/` com tokens, costura, spec de fronteira e casca vazia. Nenhuma tela muda.                         |
| 1   | Nucleo de dados                   | `concluido`    | `httpResource` + `listQuery` + comandos, provados em Pagamentos.                                                 |
| 2   | Kit de ui v1                      | `concluido`    | Painel, tabela, chip, campo, botao, cabecalho, estado, paginacao. Pagamentos, Comprovantes e Clientes migram.    |
| 3   | Dinheiro                          | `concluido`    | Saldo e Extrato, Saques, Detalhe do saque. Formulario de saque por sinal.                                        |
| 4   | Cobranca                          | `concluido`    | Detalhe do pagamento (o corte de 1440px morreu), Links, Detalhe do link e o forcar desfecho.                     |
| 5   | Integracao                        | `concluido`    | API, Webhooks, Alertas. Toaster proprio e espelho de eventos guardado por teste; `ngx-sonner` so sai na fatia 7. |
| 6   | Visao geral                       | `concluido`    | Grafico proprio em SVG; `apexcharts` e `ng-apexcharts` saem do produto.                                          |
| 7   | Produtos, Configuracoes e limpeza | `nao iniciado` | `features/dashboard/`, `shared/ui`, `libs/ui` e as dependencias saem; web entra no gate da CI.                   |

## Decisoes ja tomadas

- **Pele padrao carvao, com papel disponivel**, guardado por lojista em
  `.mer-root[data-mer-theme]` -- nunca em `:root`, porque a mesa divide a origem.
- **Escopo inclui as tres capacidades**: forcar desfecho, o fim do corte de 1440px e
  o grafico proprio.
- **A pasta e `app/merchant/`**, pelo criterio que deu `admin` ao operador: a pasta
  leva o nome de quem entra; a rota continua `/dashboard`.
- **Nada de `apps/merchant` separado.** Vale a decisao de `2026-09-09`: pasta
  autocontida agora, app proprio so com motivo de deploy ou seguranca, e
  `domain/api-contracts.ts` como unica costura.

## O que o diagnostico mediu (2026-09-15)

- `libs/ui` tem 58 componentes spartan (10.740 linhas) e **um** e importado.
- `apexcharts` custa 900 kB para uma serie de area.
- `primitives.css` tem 1.329 linhas de classe global; `panel` aparece 215x nos
  templates e a familia `btn`, ~400x.
- Servico e store global: `PaymentService` guarda 10 sinais de estado de tela e
  serve tres paginas, que dividem o mesmo `isLoading`.
- `httpResource`, `resource`, `rxResource` e os formularios por sinal estao
  instalados e nao aparecem em nenhum arquivo.
- `styles.css` carrega tres sistemas de token ao mesmo tempo, um deles (`:root.dark`
  do shadcn) sem ninguem que ligue a classe.

## Onde o projeto esta

Cinco das seis fatias do PRD pai estao no runtime, e a mesa tem quatro poderes,
todos com tela: habilitar LIVE, condicao comercial, leitura para investigar e mover
dinheiro pela loja.

| Fatia | Estado         | O que deu                                                                      |
| ----- | -------------- | ------------------------------------------------------------------------------ |
| 1     | `concluido`    | Principal `Operator`, segredo e cookies proprios, trilha append-only           |
| 2     | `concluido`    | `Account` unica por `storeId + environment`                                    |
| 3     | `concluido`    | `Store.liveStatus`, a mesa que decide, e a simulacao em LIVE que isso destrava |
| 4     | `concluido`    | Condicao comercial -- taxa, fixo e prazo, auditados e com faixa no dominio     |
| 5     | `concluido`    | Leitura cross-merchant para investigar chamado, sem secret                     |
| 6     | `nao iniciado` | Antifraude como modulo, alimentando a fila de revisao                          |

## Candidatas que ficaram para depois

- **Versionar os smokes que ja rodaram.** Tres ciclos de validacao contra a API de
  verdade foram script descartavel; o ultimo ja e o esqueleto de um `smoke:operator`,
  com 21 assercoes. Nao existe smoke nenhum da mesa, e ela escreve no ledger.
- **Fatia 6 -- antifraude e a fila de revisao.** O ultimo passo do PRD pai, e a unica
  fatia que ainda precisa de PRD do zero.
- **Acabamento da mesa.** Total nas paginacoes da fila e da trilha, validacao de
  `limit`/`offset`, retencao da trilha e a mensagem vazia do `@IsEnum`.

## Achados abertos, sem dono

- **`/dashboard/payments/:id` corta conteudo em 1440px.** A area de conteudo tem
  1.168px e um painel da coluna direita termina em 1.499px; a casca esconde o estouro
  com `overflow: hidden`, entao o texto some em silencio em vez de rolar. **Fecha na
  fatia 4.**
- **O lojista nao forca o desfecho de uma cobranca pela tela.**
  `POST /payments/:id/simulate/:action` existe na API e nao tem uma ocorrencia no
  front. Num simulador, e a promessa da landing faltando dentro do produto. **Fecha
  na fatia 4.**
- **`GET /dashboard/metrics` e orfao** -- o servico tem o metodo, ninguem chama.
- **Cliente e so leitura no dashboard**: `PATCH /customers/:externalId` existe na API
  e nao esta na tela.
- **`apps/web` fica fora do gate de lint e format da CI** -- nao tem `lint:check` nem
  `format:check`. **Fecha na fatia 7.**
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
