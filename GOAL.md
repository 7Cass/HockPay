# Hockpay - Goal

Source repo: `/Users/jpcass/Documents/2026/hockpay`
Last reviewed: `2026-09-08`
Ordering: PRD antes de codigo; conteudo antes de tela; a mesa antes do dashboard
Scope: tudo que a fatia 3 deixou operavel apenas por `curl` -- a segunda decisao da mesa, a leitura para investigar, a tela que torna as tres operaveis, e o ambiente LIVE que o lojista ainda nao ve
Status: `em validacao/hardening`

Este arquivo e o tracker executavel da goal atual. Cada macro item e uma unidade de planejamento; as checkboxes em `Subtasks` sao as unidades executaveis de implementacao e validacao.

A passagem anterior (arquivada em `docs/goals/2026-09-07-live-onboarding.md`) fechou a fatia 3: existe habilitacao LIVE por loja, a mesa decide com motivo e rastro, e loja aprovada acumula saldo no ledger LIVE. Ela deixou uma capacidade que **ninguem consegue ver nem operar**: a mesa e `curl`, e o saldo LIVE so existe por API. Esta goal fecha isso.

## Status Legend

- `nao iniciado`
- `em planejamento`
- `em implementacao`
- `em validacao/hardening`
- `concluido`

## Priority Legend

- `P0`: poder novo da mesa, ou decisao estrutural cara de reverter.
- `P1`: a superficie que torna poder existente operavel.
- `P2`: acabamento de doc e exemplo que nao muda invariante.

## Intake Snapshot

- Branch: `main` em `86e7d20`. A fatia 3 entrou pelo PR #11 (merge `ceae2d1`) e foi arquivada em `33fa274`.
- As fatias 4 e 5 entraram pelo PR #12 (merge `ec19791`) em `2026-09-07`. O `P1.1`-`P1.5` foi feito direto na `main`, a pedido, e o `P1.6`-`P1.9` tambem, em `2026-09-08`.
- Tres das seis fatias do [PRD pai](docs/PRD_OPERATOR_SURFACE.md) estao no runtime. Faltam a 4 (condicao comercial), a 5 (leitura cross-merchant) e a 6 (antifraude).
- A fatia 6 **fica fora**: o PRD pai e explicito que o motor entra depois da fila de revisao existir, e ela nao existe.
- **Nenhuma das fatias desta goal tem PRD.** A convencao do projeto e PRD antes de codigo (fatias 1, 2 e 3 fizeram assim), e PRD e doc-only, entao vai direto na `main`.
- Levantamento feito em `2026-09-07`, antes de estimar:
  - `Store._feePercent`, `_feeFixed` e `_settlementDays` sao `private readonly` -- mesma forma que `liveStatus` tinha antes da fatia 3.
  - `request.environment = Environment.TEST` esta **hardcoded** em `combined-auth.guard.ts:86`; a `JwtStrategy` nem seta o campo, quem cobre e o `?? Environment.TEST` do decorator. 14 arquivos consomem `CurrentEnvironment`.
  - `switch-store.use-case.ts:76` ja re-emite o access token ao trocar contexto de sessao -- precedente direto para trocar de ambiente.
  - As leituras que a fatia 5 precisa ja existem e sao store-scoped: `list-payments`, `get-account`, `list-transactions`, `get-payment-timeline`, `list-webhook-logs`, `list-webhook-configs`.
  - `WebhookConfig._secret` ja e guardado encriptado, com `prefix` para identificacao. A propriedade "operador nao le secret" e em boa parte estrutural; falta o teste que prova.

## Por onde comecar

**O Validation Log.** Todas as subtasks fecharam -- `P0`, `P1` e `P2` -- e o PRD pai esta cumprido menos a fatia 6, que fica fora desta goal por decisao dele. Nao ha codigo nem doc pendente.

O que falta e de outra natureza: **nada disso foi visto funcionando contra a API de verdade.** Comece por aplicar a migration de `merchant_current_environment` contra o Postgres de dev -- ela e o primeiro passo de qualquer item aberto abaixo. Depois o ciclo inteiro numa sentada: mesa aprova, lojista troca de ambiente, saldo LIVE aparece, saque LIVE sai do ledger LIVE.

## P0 - Escrever os PRDs antes do codigo

Status: `concluido`

Problema: tres entregas desta goal nao tem decisao registrada. Sem PRD, as perguntas caras (o que a mesa pode ler sem virar backdoor; onde o ambiente da sessao mora) seriam respondidas no meio da implementacao.

Impacto: as fatias 1, 2 e 3 mostraram que o PRD e o que evita reabrir decisao com codigo em cima. A fatia 3 so nao reaproveitou `isApproved` porque isso foi decidido antes de existir migration.

Subtasks:

- [x] P0.1 [`docs/PRD_OPERATOR_DESK.md`](docs/PRD_OPERATOR_DESK.md) -- cobre condicao comercial, leitura cross-merchant e a tela numa passagem so. As tres respondem a mesma pergunta ("a mesa vira mesa") e separa-las em tres PRDs seria cerimonia.
- [x] P0.2 [`docs/PRD_ENVIRONMENT_SELECTOR.md`](docs/PRD_ENVIRONMENT_SELECTOR.md) -- separado porque e outro principal e outra pergunta de produto: o que o lojista ve, e o que saque/estorno em LIVE passam a significar.

Done Criteria:

- [x] Cada PRD decide, e nao so descreve: o que a mesa pode ler, onde o ambiente da sessao mora, e o que acontece com saque/estorno em LIVE.
- [x] Os dois vao direto na `main`, doc-only.

O que os dois PRDs decidiram, e que as subtasks abaixo passam a implementar:

- **Condicao comercial muda como objeto**, nao campo a campo, com faixa validada na entidade (`fee` 0-10%, fixo 0-1000 centavos, prazo 0-90 dias). Sem migration.
- **`environment` e obrigatorio nas rotas de leitura de operador**, sem default TEST: investigar producao e receber o ledger TEST em silencio produz a conclusao errada com dado certo.
- **Nenhum use case de leitura novo.** As rotas de operador reusam os seis existentes, trocando so a origem do `storeId`. Um caminho de leitura paralelo seria um segundo lugar onde o vazamento pode nascer.
- **A varredura de secret descobre as rotas por reflexao**, no molde de `operator-routes.spec.ts`. Lista escrita a mao passa a mentir na primeira rota nova.
- **Leitura entra na trilha por investigacao aberta** (`store.investigated`), gravada pelo `GET` do detalhe da loja -- decidido em `2026-09-07`. Um `POST /investigate` separado registraria so quem foi educado.
- **O ambiente da sessao mora em `Merchant.currentEnvironment`**, ao lado de `currentStoreId`; o token so carrega a copia. E a unica migration das duas trilhas.
- **Saque e estorno em LIVE quase nao tem codigo**: os controllers ja encaminham `CurrentEnvironment`, e o worker ja processa saque LIVE. Eles chegam em TEST porque o guard escreve TEST, e por nenhum outro motivo.

## P0 - Condicao comercial, auditada (fatia 4)

Status: `concluido`

Problema: `feePercent`, `feeFixed` e `settlementDays` nascem com default e nunca mudam -- nao existe caminho de escrita. O PRD pai lista "ajustar taxa e prazo" como poder da mesa.

Impacto: e a unica fatia restante que mexe em dinheiro do lojista. Sem ela, a mesa decide **quem** opera mas nao **sob que condicao**.

Evidencia:

- `packages/core/src/domain/entities/store.entity.ts` (os tres campos `private readonly`)
- `docs/PRD_OPERATOR_SURFACE.md`, secao "O que o operador pode" e "Nao muda taxa retroativamente"

Subtasks:

- [x] P0.3 Os tres campos viram mutaveis na entidade, por metodo com regra -- nao por setter solto, como `liveStatus` fez. `Store.updateCommercialTerms` move os tres juntos; nao existe mudanca parcial.
- [x] P0.4 `POST /operator/stores/:id/commercial-terms` com `reason` obrigatorio, validado no use case.
- [x] P0.5 Acao nova na trilha (`store.commercial_terms_changed`), com `before`/`after` dos tres valores.

Done Criteria:

- [x] Mudanca de taxa nao altera o `fee` de nenhum `Payment` ja gravado, provado por teste -- e o teste usa o `FeePolicy` e o `Store` reais, nao mocks concordando entre si.
- [x] Nao existe mudanca de condicao comercial sem linha correspondente na trilha.
- [x] Valor fora de faixa e recusado pelo dominio, com `INVALID_COMMERCIAL_TERMS` no catalogo.

Achado: nao houve migration. Os tres campos ja existiam no schema com default e o `StoreRepository.update` ja os persistia; `GET /stores` ja devolvia os tres, entao o lojista nunca deixou de ver o que paga.

## P0 - Leitura para investigar chamado (fatia 5)

Status: `concluido`

Problema: o operador nao le dado de loja nenhuma. Investigar um chamado e impossivel pela superficie da mesa.

Impacto: e o poder que um operador real mais usa, e o unico que da conteudo de verdade para a tela.

Evidencia:

- As leituras ja existem e sao store-scoped (ver Intake Snapshot); o trabalho e expo-las por um caminho de operador sem alargar o que elas devolvem.
- `docs/PRD_OPERATOR_SURFACE.md`, "Nao le segredo": secret de webhook e chave de API continuam invisiveis, inclusive para operador.

Subtasks:

- [x] P0.6 Rotas de operador para payments, ledger, transacoes, timeline e entregas de webhook de uma loja escolhida, em `OperatorStoreReadController`. Reusam os use cases do merchant; nenhum use case de leitura novo.
- [x] P0.7 `operator-read-no-secrets.spec.ts`: varredura por reflexao que prova que nenhuma rota de leitura de operador devolve secret de webhook ou chave de API.
- [x] P0.8 `store.investigated` na trilha, gravado pelo `GET /operator/stores/:id`. As sub-leituras ficam puras -- decidido em P0.1 (D11), depois de pesar volume contra "quem viu o que".

Done Criteria:

- [x] Operador investiga um pagamento de qualquer loja sem tocar em credencial.
- [x] A varredura falha se uma rota futura devolver secret -- verificado invertendo `toPublicObject()` para `toObject()` de proposito: ela falha na rota certa, apontando o campo.
- [x] Nenhuma rota de leitura de operador aceita token de merchant, e vice-versa -- e2e cobre as sete rotas com cookie de merchant e com API key.

## P1 - A mesa ganha tela

Status: `concluido`

Problema: a mesa tem fronteira, trilha e (depois dos itens acima) tres poderes, e nada disso tem tela. O PRD pai e explicito: "trilha que so existe no banco nao e trilha, e log".

Impacto: nenhuma capacidade nova. O que muda e que a superficie de operador passa a ser parte do que o simulador **ensina**, que e o argumento de produto que a justifica. Ninguem aprende o formato de decisao de um gateway por `curl`.

Evidencia:

- `apps/web` tinha `auth.guard.ts`/`guest.guard.ts` e tres layouts, todos de merchant. Nao existia nada de operador.
- `docs/CURRENT_STATE.md`, Matriz de Superficies: "sem dashboard de operador".

Subtasks:

- [x] P1.1 Sessao de operador em `apps/web`, com guard e layout proprios -- sem reusar o caminho de merchant.
- [x] P1.2 Fila de habilitacao e decisao (aprovar/rejeitar/suspender) com motivo.
- [x] P1.3 Condicao comercial editavel, com o antes e o depois visiveis.
- [x] P1.4 Trilha legivel na propria superficie.
- [x] P1.5 Investigacao de loja, usando as rotas de leitura de P0.6.

Done Criteria:

- [x] Um operador opera a fila inteira, decide, ajusta condicao e le a trilha sem `curl`.
- [x] Nenhuma tela de operador expoe secret de webhook ou chave de API.
- [x] Sessao de merchant e de operador coexistem no mesmo browser sem se atrapalhar.

Achados de `2026-09-07`, com a tela fechada:

- **O interceptor era o unico lugar onde as duas sessoes se encostavam.** `auth.interceptor.ts` renovava o token de merchant em qualquer `401`, inclusive num `401` de `/operator/...`. Os cookies ja tinham paths proprios, entao a fronteira do backend estava de pe -- quem a furava era a camada de cima, exatamente o risco que a tabela de riscos previa. Agora ele escolhe a sessao pelo dono da rota, e o spec prova os dois sentidos.
- **`Store` do lojista nao serve para a mesa.** Falta `merchantId`: o lojista nunca precisa saber de qual comerciante e a propria loja, e a mesa comeca toda investigacao por ai. Virou `OperatorStore = Store & { merchantId }` em vez de alargar o tipo do lojista.
- **A fila e a trilha nao tem total.** As duas rotas paginam por `offset`/`limit` e nao devolvem contagem, entao a tela anda por "anterior/proxima" e nao por numero de pagina. O componente `Pagination` existente pede `total` e nao serve; nao foi alterado.
- **`store.investigated` e gravado inclusive para quem abre a loja so para mexer na taxa.** E o D11 funcionando como escrito, nao um efeito colateral: quem abriu a loja abriu a loja.
- A tela nao foi exercitada contra a API de verdade nesta passagem -- ver o Validation Log.

## P1 - O lojista enxerga o LIVE que a fatia 3 encheu

Status: `concluido`

Problema: `request.environment` e TEST fixo para toda sessao JWT. O dashboard nao consegue mostrar LIVE porque a sessao nao sabe dizer outra coisa.

Impacto: e a divida que a fatia 3 criou. Aprovar uma loja para LIVE hoje produz um saldo que so aparece por API -- o oposto do que a fatia 3 existe para ensinar. E saque e estorno em LIVE seguem bloqueados por acidente de sessao, nao por decisao de produto.

Evidencia:

- `apps/api/src/modules/auth/guards/combined-auth.guard.ts:86` (`request.environment = Environment.TEST`)
- `apps/api/src/modules/auth/strategies/jwt.strategy.ts` (nao seta o campo)
- `docs/CURRENT_STATE.md`, Gaps: "Dashboard nao tem seletor TEST/LIVE"

Subtasks:

- [x] P1.6 `environment` entra no `JwtPayload`; o guard le em vez de assumir.
- [x] P1.7 Rota de troca de ambiente que re-emite o par de tokens, seguindo `switch-store`.
- [x] P1.8 Seletor na tela, com LIVE marcado como simulado onde ele aparecer.
- [x] P1.9 Saque e estorno em LIVE, conforme o PRD decidir.

Done Criteria:

- [x] Dashboard em LIVE mostra o ledger LIVE e nunca mistura com o TEST, provado por teste que le os dois -- saque e estorno, cada um lendo as duas contas.
- [x] Trocar de ambiente invalida a sessao anterior, como `switch-store` ja faz.
- [x] Loja sem habilitacao LIVE nao consegue selecionar LIVE -- provado nos quatro estados que nao sao `APPROVED`, no use case e na tela.

Achados de `2026-09-08`, com as quatro subtasks fechadas:

- **O login precisava da mesma reconferencia que o refresh.** O PRD decidiu D5 so para o refresh, mas `currentEnvironment` sobrevive ao logout: um lojista com a loja suspensa entraria direto em LIVE ao voltar. Os dois caminhos passaram a compartilhar `resolveSessionEnvironment`, que rebaixa e persiste em vez de falhar. E o mesmo raciocinio de D5, aplicado onde ele tambem valia.
- **Criar loja tambem reseta para TEST.** D4 fala de `switch-store`, mas `create-store` muda a loja atual pelo mesmo mecanismo, e uma loja recem-criada nunca esta habilitada. Sem o reset, D4 teria um buraco do tamanho de um botao.
- **`callerEnvironment` ficou opcional no input de saque, nao obrigatorio.** O worker nao tem chamador, e obriga-lo a inventar um seria pior que o problema. Sob `simulation` o guard falha fechado na ausencia, entao esquecer resulta em recusa -- que e a propriedade que importava. Mesmo formato que `expire-payment` ja usava com `systemInitiated`.
- **Os fixtures de saque e de estorno tinham uma conta so, e mentiam.** O schema tem uma conta por ambiente desde a fatia 2; os fixtures ignoravam o argumento. Duas asserções antigas so passavam porque os dois ledgers eram o mesmo objeto -- elas quebraram no instante em que o fixture passou a dizer a verdade. Nao da para provar isolamento com um ledger.
- **A tela do saldo mentia por omissao.** A descricao dizia "LIVE tem um ledger separado, e o dashboard nao o mostra". Agora mostra, e diz onde trocar.

## P2 - Docs acompanham

Status: `concluido`

Subtasks:

- [x] P2.1 `CURRENT_STATE.md`: Matriz de Maturidade, Matriz de Superficies e a secao de isolamento TEST/LIVE.
- [x] P2.2 `PRODUCT.md`: a jornada de operador, e o que o seletor de ambiente muda para o lojista.
- [x] P2.3 Fechar no `CURRENT_STATE` os itens que deixam de ser gap.

Achados de `2026-09-08`, escrevendo os docs:

- **"JWT = TEST" estava em tres lugares do `CURRENT_STATE`**, e nao em um: na Idempotencia, na linha de saldo do dashboard e no isolamento. Era premissa das tres, entao `P1.6` invalidou as tres de uma vez sem que nenhuma delas fale de token. Virou uma linha so, com as tres origens de ambiente juntas (sessao, key, query de operador) -- e o `?? TEST` do guard descrito pelo que ele realmente cobre: token mintado antes do campo existir.
- **Apagar gap fechado nao e atualizar a lista.** Sairam tres itens; entraram cinco, e o que mais importa e o que nenhuma subtask produziu: nenhuma das duas trilhas foi exercitada contra a API de verdade. "Coberto por teste" e "visto funcionando" sao coisas diferentes, e o documento canonico e onde essa diferenca tem que aparecer.
- **Gap novo, achado ao escrever: ambiente e por sessao, nao por aba.** O cookie e do browser inteiro, entao `switch-environment` move todas as abas; as ja renderizadas seguem mostrando o ambiente anterior ate recarregarem. Nao muda invariante -- a sessao esta correta o tempo todo -- mas e exatamente o tipo de coisa que gera chamado.
- **Duas linhas estavam velhas desde antes desta goal.** A trilha listava so `operator.login` e `operator.logout` (sao sete acoes desde a fatia 3 + P0), e "Dev simulation" dizia "endpoints TEST" quando simular em LIVE existe sob habilitacao. Doc que so e atualizado no fim da goal acumula divida da goal anterior.
- **`PRODUCT.md` nao tinha jornada de operador.** A mesa aparecia so como um passo dentro da habilitacao LIVE -- o que ela faz *para o lojista*, nao o que ela e. E o que ela e virou o argumento de produto desta goal.

## Public APIs / Interfaces Mentioned By This Goal

- `POST /operator/stores/:id/commercial-terms`
- Rotas de leitura de operador por loja (payments, ledger, transacoes, timeline, webhook logs)
- Rota de troca de ambiente para merchant
- `environment` no `JwtPayload`
- Acoes novas em `OPERATOR_AUDIT_ACTION`
- Rotas de `apps/web` sob a sessao de operador

## Validation Log For This Goal

Rodado em `2026-09-07`, com o P0 e a tela (`P1.1`-`P1.5`) fechados:

- [x] `pnpm --filter @hockpay/core test:ci` (318, era 291)
- [x] `pnpm --filter @hockpay/infrastructure test` (79)
- [x] `pnpm --filter @hockpay/api test` (185, era 169)
- [x] `pnpm --filter @hockpay/api test:e2e` (30, era 22)
- [x] `pnpm --filter @hockpay/worker test` (33)
- [x] `pnpm --filter @hockpay/web test -- --watch=false` (130, era 68)
- [x] `pnpm run lint:check`, `pnpm run format:check`, `pnpm build`

`P2` e doc-only e nao roda teste; a validacao dele e a leitura contra o codigo, feita rota a rota ao escrever (rotas do operador, DTO de ambiente, `switch-environment`, faixas de `updateCommercialTerms`, catalogo de acoes da trilha).

Rodado em `2026-09-08`, com `P1.6`-`P1.9` fechados:

- [x] `pnpm --filter @hockpay/core test:ci` (342, era 318)
- [x] `pnpm --filter @hockpay/infrastructure test` (79)
- [x] `pnpm --filter @hockpay/api test` (191, era 185)
- [x] `pnpm --filter @hockpay/api test:e2e` (33, era 30)
- [x] `pnpm --filter @hockpay/worker test` (33)
- [x] `pnpm --filter @hockpay/web test -- --watch=false` (151, era 130)
- [x] `pnpm run lint:check`, `pnpm run format:check`, `pnpm build`
- [x] `grep -r assertNotLiveEnvironment` nao acha nada em `apps` nem em `packages/*/src` -- criterio de aceite do PRD, verificado
- [ ] **`prisma migrate` da coluna nova aplicado contra o Postgres de dev** -- a migration foi escrita e o schema regenerado, mas nao rodou contra banco nenhum nesta passagem. E o primeiro passo de qualquer validacao abaixo
- [ ] `smoke:docker` completo -- pendente; nenhuma das duas trilhas mudou caminho de smoke
- [ ] **Fluxo de operador exercitado na tela, ponta a ponta** -- as telas existem e sao cobertas por teste contra HTTP mockado; ninguem passou por elas contra a API de verdade ainda. E a diferenca entre "a capacidade existe" e "a capacidade foi vista funcionando"
- [ ] **Dashboard em LIVE exercitado contra Postgres local, lendo os dois ledgers** -- o isolamento esta provado por unit test com dois fixtures de conta; falta ver o ciclo inteiro (mesa aprova -> lojista troca -> saldo LIVE aparece -> saque LIVE sai do ledger LIVE) contra o banco
- [ ] Trocar de ambiente com o token antigo na mao, contra a API de verdade -- a revogacao esta provada no use case, nao no HTTP
- [ ] Ciclo de condicao comercial e de investigacao rodado contra o Postgres de dev com os repositorios reais, como a fatia 3 fez -- os unit tests mockam `findByIdForUpdate`

## Fora desta goal

- **Antifraude como modulo (fatia 6).** O PRD pai e explicito: o motor entra depois da fila de revisao existir.
- Papeis dentro de `Operator`, impersonacao, MFA, retencao/purga da trilha.
- Logout de merchant que nao revoga o refresh token no banco (achado de `2026-09-06`, ainda sem correcao).
- KYC de verdade, chargeback, adquirencia real.

## Assumptions

- PRD antes de codigo, e PRD e doc-only, entao vai direto na `main`. Codigo vai por branch e PR -- com a excecao de `P1.1`-`P1.5` e `P1.6`-`P1.9`, feitos direto na `main` a pedido, em commit por subtask. `P2` e doc-only, entao segue a regra geral e tambem foi na `main`.
- As fatias 1, 2 e 3 estao no runtime e nao serao refeitas.
- `Payment.fee` continua sendo snapshot no momento da cobranca; a condicao comercial vale so para o futuro.

## Riscos

| Risco                                          | Como aparece                                      | O que segura                                                                                      |
| ---------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| A goal e grande demais para uma passagem       | Meses sem merge, e um PR gigante no fim           | Cada macro item e entregavel sozinho; ver "Onde cortar"                                           |
| Rota de leitura de operador vazando secret     | Credencial exposta, sem erro visivel              | Teste de varredura (P0.7), criterio de aceite e nao acabamento                                    |
| Tela de operador reusando a sessao de merchant | Fronteira da fatia 1 dissolvida na camada de cima | Aconteceu, no interceptor -- fechado em `P1.1`, com spec nos dois sentidos                        |
| `environment` no token sem checar habilitacao  | Loja nao habilitada selecionando LIVE             | O gate mora no use case, nao na tela. Fechado em `P1.7`, com o login reconferindo alem do refresh |
| Formatar com `pnpm run format` na raiz         | 413 arquivos de churn que o gate de CI nao pega   | Achado de `2026-09-07`: formatar por pacote -- seguido nesta passagem                             |

## Onde cortar, se a passagem ficar grande

As duas trilhas fecharam, entao nao ha mais o que cortar. Ficam registradas porque a divisao funcionou:

- **A mesa vira mesa:** condicao comercial, leitura cross-merchant e tela. Fecha o PRD pai menos a fatia 6. `concluido`
- **O lojista enxerga LIVE:** seletor de ambiente. Fecha a divida da fatia 3. `concluido`

Elas nao dependiam uma da outra, e cada uma coube numa sequencia de commits por subtask. Dentro da primeira, a ordem importou: condicao comercial e leitura vieram antes da tela, porque tela sem conteudo e a mesma capacidade fantasma que o projeto ja removeu uma vez.

## Passagens anteriores

- `docs/goals/2026-08-18-architecture-hardening.md`
- `docs/goals/2026-08-18-workspace-honesty-and-integrity.md`
- `docs/goals/2026-08-19-leftover-authz-and-read-isolation.md`
- `docs/goals/2026-08-19-test-live-identity-isolation.md`
- `docs/goals/2026-09-06-operator-boundary-and-environment-ledger.md`
- `docs/goals/2026-09-07-live-onboarding.md`
