# Hockpay - Goal (arquivada)

Arquivada em `2026-09-08`. Nao ha goal ativa; a proxima esta em aberto em `/GOAL.md`.

Source repo: `/Users/jpcass/Documents/2026/hockpay`
Last reviewed: `2026-09-08`
Ordering: PRD antes de codigo; conteudo antes de tela; a mesa antes do dashboard
Scope: tudo que a fatia 3 deixou operavel apenas por `curl` -- a segunda e a terceira decisao da mesa, a tela que as torna operaveis, e o ambiente LIVE que o lojista ainda nao via
Status final: `concluido`. A validacao contra a API de verdade foi feita em `2026-09-08`, depois do arquivamento; so o passo pela tela continua aberto

A fatia 3 deixou uma capacidade que **ninguem conseguia ver nem operar**: a mesa era `curl`, e o saldo LIVE so existia por API. Esta passagem fechou isso pelos dois lados -- a mesa virou mesa, e o lojista passou a enxergar o LIVE que a fatia 3 enchia.

Ela fecha o [PRD da superficie de operador](../PRD_OPERATOR_SURFACE.md) menos a fatia 6, que fica de fora por decisao do proprio PRD: o motor de antifraude entra depois da fila de revisao existir, e ela nao existe.

## O que entrou

| PR/commit | Entrega                                                                       |
| --------- | ----------------------------------------------------------------------------- |
| `3f38035` | [PRD da mesa](../PRD_OPERATOR_DESK.md) -- condicao comercial, leitura e tela  |
| `a78090d` | [PRD do seletor de ambiente](../PRD_ENVIRONMENT_SELECTOR.md)                  |
| #12       | Os dois commits abaixo, mergeado em `ec19791`                                 |
| `955e137` | Condicao comercial mutavel, com faixa no dominio e trilha                     |
| `653ede8` | Leitura cross-merchant para investigar chamado                                |
| `edcd3bc` | Sessao de operador em `apps/web`, com guard e casca proprios                  |
| `993a813` | Fila de habilitacao e decisao com motivo                                      |
| `cfa9d45` | Condicao comercial editavel, com o antes e o depois na tela                   |
| `4f46887` | Trilha legivel na propria superficie da mesa                                  |
| `6ac1048` | Investigacao de loja, com ambiente explicito e sem segredo                    |
| `48a0afc` | O ambiente da sessao mora no merchant, e o token carrega a copia              |
| `c2d54d0` | Rota de troca de ambiente, com o gate de habilitacao no use case              |
| `5d02c5c` | Seletor de ambiente na topbar, com LIVE marcado como simulado                 |
| `3f2e42d` | Saque e estorno alcancam o ledger LIVE                                        |
| `3e2e4ff` | `CURRENT_STATE`: matrizes e isolamento                                        |
| `5c354f8` | `PRODUCT`: a jornada da mesa e o que o seletor muda                           |
| `0b325a0` | `CURRENT_STATE`: gaps fechados, e os que tomaram o lugar                      |

As telas (`P1.1`-`P1.5`) e o seletor (`P1.6`-`P1.9`) foram direto na `main`, a pedido, em commit por subtask. Cada commit deixa a `main` num estado inteiro.

## Decisoes que valem para as proximas fatias

- **Condicao comercial muda como objeto, nao campo a campo.** `Store.updateCommercialTerms` move `feePercent`, `feeFixed` e `settlementDays` juntos, com faixa validada na entidade (0-10%, 0-1000 centavos, 0-90 dias). Nao existe mudanca parcial, e nao existe setter solto -- que foi o que `liveStatus` evitou na fatia 3 e continua valendo.
- **`environment` e obrigatorio nas rotas de leitura de operador, sem default TEST.** Um merchant resolve ambiente da sessao; um operador nao opera uma loja, investiga varias. Investigar producao e receber o ledger TEST em silencio produz a conclusao errada com dado certo, e nada na resposta diria qual ambiente foi lido.
- **Nenhum use case de leitura novo.** As sete rotas de operador reusam os use cases que o merchant ja chama, trocando so a origem do `storeId`. Um caminho de leitura paralelo, com a propria nocao do que devolver, seria um segundo lugar onde o vazamento pode nascer.
- **A varredura de secret descobre as rotas por reflexao.** `operator-read-no-secrets.spec.ts` percorre o que esta registrado no modulo. Lista escrita a mao passa a mentir na primeira rota nova, que e exatamente quando o teste precisa funcionar.
- **Leitura entra na trilha por investigacao aberta, nao por sub-leitura.** `store.investigated` e gravado pelo `GET /operator/stores/:id`; as sub-leituras ficam puras. Um `POST /investigate` separado registraria so quem foi educado.
- **O ambiente da sessao mora em `Merchant.currentEnvironment`**, ao lado de `currentStoreId` -- que e exatamente o mesmo tipo de fato. O token so carrega a copia. Foi a unica migration das duas trilhas.
- **O gate de LIVE mora no use case, nao na tela.** Opcao desabilitada num dropdown e cortesia; `SwitchEnvironmentUseCase` e a regra. TEST nunca e recusado, em nenhum dos cinco estados.
- **Reemitir o par de tokens e o que faz a troca valer.** Um token TEST ainda valido depois de trocar para LIVE e uma sessao lendo o ledger errado sem ninguem ter pedido. Mesma ordem que `switch-store` ja usava: valida, persiste, revoga, reemite.
- **A troca recarrega, nao filtra.** Tratar o resultado como filtro de cliente deixaria dado de um ambiente na tela do outro por um instante -- a confusao que a fatia 2 separou o ledger para evitar.
- **LIVE nunca aparece sozinho na tela.** O rotulo "simulado" anda junto no gatilho, na opcao e no saldo. Um selo LIVE identico ao de um gateway real seria a mentira mais cara que o simulador consegue contar.
- **A porta fechada aparece fechada, nao some.** Loja sem habilitacao ve LIVE desabilitado, com o estado atual e o caminho para Settings. Esconder ensinaria que producao e um lugar para onde nunca se vai.

## Achados que mudaram o plano

- **O interceptor era o unico lugar onde as duas sessoes se encostavam.** `auth.interceptor.ts` renovava o token de merchant em qualquer `401`, inclusive num `401` de `/operator/...`. Os cookies ja tinham paths proprios, entao a fronteira do backend estava de pe -- quem a furava era a camada de cima, exatamente o risco que a tabela de riscos previa. Passou a escolher a sessao pelo dono da rota, com spec nos dois sentidos.
- **`Store` do lojista nao serve para a mesa.** Falta `merchantId`: o lojista nunca precisa saber de qual comerciante e a propria loja, e a mesa comeca toda investigacao por ai. Virou `OperatorStore = Store & { merchantId }`, em vez de alargar o tipo do lojista.
- **O login precisava da mesma reconferencia que o refresh.** O PRD decidiu isso so para o refresh, mas `currentEnvironment` sobrevive ao logout: um lojista com a loja suspensa entraria direto em LIVE ao voltar. Os dois passaram a compartilhar `resolveSessionEnvironment`, que **rebaixa e persiste** em vez de falhar -- trancar o lojista fora da propria sessao e pior do que aquilo que a suspensao tenta evitar.
- **Criar loja tambem reseta para TEST.** A decisao falava de `switch-store`, mas `create-store` muda a loja atual pelo mesmo mecanismo, e loja recem-criada nunca esta habilitada. Sem o reset, a regra teria um buraco do tamanho de um botao.
- **Os fixtures de saque e de estorno tinham uma conta so, e mentiam.** O schema tem uma conta por ambiente desde a fatia 2; os fixtures ignoravam o argumento. Duas assercoes antigas so passavam porque os dois ledgers eram o mesmo objeto, e quebraram no instante em que o fixture passou a dizer a verdade. **Nao da para provar isolamento com um ledger.**
- **A tela do saldo mentia por omissao.** Dizia que "LIVE tem um ledger separado, e o dashboard nao o mostra" -- verdade quando foi escrita, falsa depois do seletor. Mesmo padrao do `financials.html` da fatia 3: nenhum teste cobre texto de tela.
- **"JWT = TEST" estava em tres lugares do `CURRENT_STATE`**, e nao em um: Idempotencia, saldo do dashboard e isolamento. Era premissa das tres, entao uma subtask invalidou as tres de uma vez sem que nenhuma delas fale de token.
- **`store.investigated` e gravado inclusive para quem abre a loja so para mexer na taxa.** E a decisao funcionando como escrita, nao efeito colateral: quem abriu a loja abriu a loja.
- **A fila e a trilha nao tem total.** As duas rotas paginam por `offset`/`limit` sem devolver contagem, entao a tela anda por "anterior/proxima" e nao por numero de pagina. O componente `Pagination` existente pede `total` e nao serve; nao foi alterado.
- **Ambiente e por sessao, e nao por aba.** O cookie e do browser inteiro, entao trocar numa aba move todas; as ja renderizadas seguem mostrando o ambiente anterior ate recarregarem. Nao quebra invariante -- a sessao esta correta o tempo todo -- mas e o tipo de coisa que gera chamado.

## Achados de processo

- **`prisma format` realinha o schema inteiro.** A migration desta passagem acrescenta **uma coluna**, e o diff de `schema.prisma` tem 773 linhas: o formatter realinhou todos os modelos. E a mesma classe do achado da fatia 3 sobre `pnpm run format` na raiz, com outra ferramenta -- e a regra, como estava escrita ("formatar por pacote"), nao cobria essa. **Nas proximas passagens: conferir o diff de `schema.prisma` antes de commitar, e separar o realinhamento da mudanca real quando ele acontecer.**
- **Doc atualizado so no fim da goal acumula divida da goal anterior.** Duas linhas do `CURRENT_STATE` ja estavam erradas antes desta passagem comecar: a trilha listava so `operator.login` e `operator.logout` (sao sete acoes desde a fatia 3), e "Dev simulation" dizia "endpoints TEST" quando simular em LIVE existe sob habilitacao desde a fatia 3.
- **Apagar gap fechado nao e atualizar a lista de gaps.** Sairam tres itens; entraram cinco. Uma lista que so encolhe passa a mentir por omissao.

## Validation Log

Rodado em `2026-09-07`, com o `P0` e a tela fechados:

- [x] `pnpm --filter @hockpay/core test:ci` (318, era 291)
- [x] `pnpm --filter @hockpay/infrastructure test` (79)
- [x] `pnpm --filter @hockpay/api test` (185, era 169)
- [x] `pnpm --filter @hockpay/api test:e2e` (30, era 22)
- [x] `pnpm --filter @hockpay/worker test` (33)
- [x] `pnpm --filter @hockpay/web test -- --watch=false` (130, era 68)
- [x] `pnpm run lint:check`, `pnpm run format:check`, `pnpm build`

Rodado em `2026-09-08`, com `P1.6`-`P1.9` fechados, e reconferido no fim da passagem com os mesmos numeros:

- [x] `pnpm --filter @hockpay/core test:ci` (342, era 318)
- [x] `pnpm --filter @hockpay/infrastructure test` (79)
- [x] `pnpm --filter @hockpay/api test` (191, era 185)
- [x] `pnpm --filter @hockpay/api test:e2e` (33, era 30)
- [x] `pnpm --filter @hockpay/worker test` (33)
- [x] `pnpm --filter @hockpay/web test -- --watch=false` (151, era 130)
- [x] `pnpm run lint:check`, `pnpm run format:check`, `pnpm build`
- [x] `grep -r assertNotLiveEnvironment` nao acha nada em `apps` nem em `packages/*/src` -- criterio de aceite do PRD, verificado
- [x] A varredura de secret falha se uma rota futura devolver credencial -- verificado invertendo `toPublicObject()` para `toObject()` de proposito: ela falha na rota certa, apontando o campo

Rodado em `2026-09-08`, depois do arquivamento, contra a API e o Postgres de dev:

- [x] **`prisma migrate deploy` da coluna nova aplicado contra o Postgres de dev.** `deploy` e nao `dev`, de proposito: o banco tem 165 payments e historico, e `migrate dev` propoe reset em caso de drift. Antes: 28 de 29 migrations, coluna ausente. Depois: `Database schema is up to date`, coluna `current_environment` (`Environment`, `NOT NULL`, default `'TEST'`), **14 merchants todos em TEST**. Nada mais se moveu -- 13 stores todas ativas e `NOT_REQUESTED`, ledger TEST em `pending=234244`, 165 payments. A migration se comportou como o comentario dela prometia: sem backfill, porque `TEST` para todo merchant existente ja era o que o guard escrevia por linha de codigo
- [x] **Ciclo LIVE ponta a ponta contra a API de verdade** -- 22 assercoes. Sessao nasce TEST; trocar para LIVE **sem** aprovacao e recusado (422); a loja aparece na fila; a mesa aprova; a troca e aceita; pagamento com `hk_live_` nasce LIVE; depois de confirmar e liberar o ledger LIVE fica em `available=49235` com o TEST em `0/0/0`; o saque nasce marcado LIVE e bloqueia `20000` no ledger LIVE sem tocar o TEST; e o worker fechou sozinho em `COMPLETED env=LIVE`, com o LIVE indo a `29235`. **O isolamento que so tinha prova de fixture agora tem prova de banco**
- [x] **Ciclo de condicao comercial e de investigacao com os repositorios reais** -- 16 assercoes. Faixa recusada pelo dominio (`INVALID_COMMERCIAL_TERMS`, 422); o lojista ve a nova condicao; **o pagamento cobrado antes manteve `fee=1515` em vez de `10400`** -- o snapshot provado contra o banco, e nao contra mocks concordando entre si; a trilha carrega `before`/`after` e motivo; abrir a loja gravou `store.investigated`; leitura de operador **sem** `environment` e recusada (400); e nenhuma das seis rotas de leitura devolveu credencial
- [x] `smoke:docker` completo -- as seis suites `"ok": true`, exit 0, com os containers proprios criados e destruidos. O banco de dev nao foi tocado
- [~] Trocar de ambiente com o token antigo na mao -- **provado pela metade, e o que faltou virou achado.** O refresh token de antes da troca e recusado (401). O **access token** de antes continua valido e devolveu `200 lendo o ledger TEST` com a sessao ja em LIVE. Ver as dividas abaixo
- [ ] **Fluxo de operador exercitado na tela, ponta a ponta** -- continua aberto, e nao por falta de tentativa: o repo nao tem automacao de browser (`smoke:p3:visual` e um seeder HTTP, nao um driver de tela). Precisa de alguem clicando

**Nao ha smoke de operador nem de seletor de ambiente.** O ciclo acima foi um script de validacao descartavel, nao uma suite versionada -- entao ele provou o comportamento uma vez e nao protege contra regressao.

## Dividas que esta passagem criou

- **Loja suspensa continua sacando em LIVE.** Decidido em `2026-09-08`, depois da passagem fechar: loja com o LIVE suspenso nao faz movimentacao financeira por conta propria; saque e estorno viram trabalho da mesa, por chamado. Hoje `create-payment` releva a habilitacao no momento da chamada e recusa, mas `create-withdrawal` so checa `isActive` -- entao na janela entre a suspensao e o proximo refresh, **dinheiro nao entra e sai**. A assimetria nasceu aqui: enquanto a sessao JWT era TEST fixo, saque nunca alcancava o ledger LIVE e a pergunta nao existia. Fechar exige as duas metades -- o gate no saque e a via do operador --, porque so a primeira deixaria o saldo LIVE sem saida nenhuma.
- **O comentario de `switch-environment.use-case.ts` prometia mais do que o codigo entrega** -- dizia que revogar o refresh impede "a still-valid TEST token after a switch to LIVE", e o ciclo mostrou que o access token anterior segue lendo o ambiente antigo por ate 15 minutos. Revisto em `2026-09-08`: **o comportamento e consequencia de D1/D2 do PRD do seletor** (o token e a copia, atualizada so onde tokens sao emitidos), nao um defeito -- e o cookie e substituido no browser inteiro, entao nenhum cliente legitimo fica com o token velho. O que era defeito era a frase, e ela foi corrigida junto com o PRD, que agora registra a janela para ela nao ser redescoberta como bug. **Fica a regra: caminho que move dinheiro rele a loja na chamada, como `CreatePaymentUseCase` faz, em vez de contar com revogacao que nao existe** -- e assim que o congelamento tem que ser construido
- **`@IsEnum` recebendo array em vez de enum.** `operator-store.dto.ts`, no campo `decision`. A validacao funciona, mas a mensagem de erro sai `"decision must be one of the following values: "` -- com a lista vazia, porque `Object.keys` de um array da indices numericos que o class-validator filtra. Quem chama a rota errado nao descobre o que e aceito
- **Deletar uma store com saque falha, mesmo com tudo em CASCADE.** `withdrawals.bank_account_id -> bank_accounts` e `RESTRICT`, enquanto `bank_accounts.store_id -> stores` e `CASCADE`: o cascade tenta apagar o destino Pix antes do saque que o referencia. Encontrado ao limpar a massa de teste; so aparece em delete de store, que a aplicacao nao faz
- **O `RESTRICT` de `operator_audit_logs -> operators` funciona, e vale registrar como propriedade e nao como obstaculo:** o banco recusa apagar um operador que ja agiu. A trilha append-only nao depende so da porta sem `delete` -- o schema tambem a defende
- **A decisao da mesa nao revoga a sessao do lojista.** `DecideLiveEnablementUseCase` nao mexe em token nem em `currentEnvironment`; quem rebaixa e o proximo login ou refresh, ate 15 minutos depois.
- **`?limit=abc` vira `NaN`** nas duas rotas de operador que fazem parse de paginacao a mao (fila e trilha). Anterior a esta passagem, mas agora tem tela dirigindo as duas.

## Fora desta passagem

- **Antifraude como modulo (fatia 6).** O PRD pai e explicito: o motor entra depois da fila de revisao existir, e ela nao existe.
- Papeis dentro de `Operator`, impersonacao, MFA, retencao/purga da trilha.
- Logout de merchant que nao revoga o refresh token no banco (achado de `2026-09-06`, ainda sem correcao).
- Total nas paginacoes da fila e da trilha, e o `Pagination` que depende dele.
- KYC de verdade, chargeback, adquirencia real.
