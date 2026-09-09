# PRD - O lojista escolhe o ambiente

> **Status: proposta. Nada descrito aqui existe no runtime.**
> Este documento decide onde o ambiente de uma sessao de merchant mora, e o que
> saque e estorno em LIVE passam a significar. Ele nao descreve o sistema atual
> -- para isso, [CURRENT_STATE.md](CURRENT_STATE.md).

Last reviewed: `2026-09-07`
Depende de: [ledger por ambiente](PRD_ENVIRONMENT_LEDGER.md) (fatia 2, implementada) e [onboarding LIVE](PRD_LIVE_ONBOARDING.md) (fatia 3, implementada)

## Por que este documento existe separado

A [mesa](PRD_OPERATOR_DESK.md) e o outro principal, e a outra pergunta. Este
documento e sobre o **lojista**: o que ele ve, e o que ele passa a poder fazer.

Ele existe porque a fatia 3 criou uma divida com nome e endereco. Aprovar uma
loja para LIVE hoje produz um saldo que **so aparece por API**. O dashboard nao
consegue mostra-lo, nao porque falte tela, mas porque a sessao nao sabe dizer
outra coisa:

```ts
// apps/api/src/modules/auth/guards/combined-auth.guard.ts:86
request.environment = Environment.TEST;
```

E o oposto do que a fatia 3 existe para ensinar. A mesa aprova, o ledger LIVE
enche, e o lojista nao ve nada acontecer.

## O estado que este documento toca

| Onde                                      | Fato de hoje                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `combined-auth.guard.ts:86`               | `request.environment = Environment.TEST`, **hardcoded**, para toda sessao JWT          |
| `jwt.strategy.ts`                         | Nao seta `environment`; quem cobre e o `?? Environment.TEST` do decorator              |
| `JwtPayload`                              | `sub`, `aud`, `storeId`, `iat`, `exp`. Sem ambiente                                    |
| `CurrentEnvironment`                      | Consumido por 14 controllers                                                           |
| `Merchant.currentStoreId`                 | A loja da sessao **ja mora no merchant**, nao no token nem no refresh token            |
| `refresh-token.use-case.ts:71`            | Re-emite lendo `merchant.currentStoreId`                                               |
| `switch-store.use-case.ts:76`             | Re-emite o par de tokens ao trocar contexto, revogando o refresh anterior              |
| `RefreshToken.merchantId`                 | `@unique`: existe no maximo um refresh token vivo por merchant                         |
| `withdrawal.controller.ts:61,112,137`     | **Ja passa** `@CurrentEnvironment()` para os use cases                                 |
| `refund.controller.ts:47`                 | **Ja passa** `callerEnvironment` para `assertCallerCanMutateEnvironment`               |
| `complete-withdrawal` / `fail-withdrawal` | `assertNotLiveEnvironment` apenas sob `input.simulation` -- o worker nao passa por ele |
| `apps/web` `dashboard-layout`             | Sem seletor de ambiente em lugar nenhum                                                |

**O achado que encolhe esta passagem:** saque e estorno **nao estao bloqueados
por regra**. Os controllers ja encaminham o ambiente da request para os use
cases; eles chegam em TEST porque o guard escreve TEST, e por nenhum outro
motivo. Quando a sessao souber dizer LIVE, os dois destravam sozinhos.

O que sobra de trabalho real e uma coisa so: **onde o ambiente da sessao mora**.

---

## D1. O ambiente mora no `Merchant`, e o token so carrega

A pergunta central deste PRD tem tres respostas plausiveis. A escolhida:

```prisma
model Merchant {
  // ...
  currentStoreId     String?     @map("current_store_id")
  currentEnvironment Environment @default(TEST) @map("current_environment")
}
```

e o `JwtPayload` ganha o campo como **copia**:

```ts
export interface JwtPayload {
  sub: string;
  aud: TokenAudience;
  storeId?: string | null;
  environment?: Environment;
  iat?: number;
  exp?: number;
}
```

As alternativas, e por que nao:

| Alternativa                   | Por que nao                                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| So no token, sem persistir    | O refresh acontece a cada 15 minutos e nao tem de onde reler o ambiente. O lojista cairia para TEST sozinho, no meio de uma sessao, sem ter pedido.                                                          |
| Numa coluna do `RefreshToken` | Funciona, mas coloca a preferencia de sessao num objeto de credencial. `currentStoreId` -- que e exatamente o mesmo tipo de fato -- ja mora no merchant, e nao ha razao para o vizinho morar em outro lugar. |
| Num cookie ou header proprio  | O ambiente decide qual ledger a request le. Um cookie separado do token e um pedaco de autorizacao que viaja sem assinatura, e que o guard teria que confiar.                                                |

A regra que sai disso: **o token e a copia, o merchant e a fonte.** Todo lugar
que re-emite um token (login, refresh, `switch-store`, `create-store`) le
`merchant.currentEnvironment` -- do mesmo jeito que ja le `currentStoreId`.

## D2. O guard le o campo, e a ausencia dele e TEST

```ts
request.environment = payload.environment ?? Environment.TEST;
```

O `??` nao e descuido, e ele fica. Duas razoes:

1. **Rollout.** Tokens emitidos antes do deploy circulam por ate 15 minutos sem
   o campo. Sem o fallback, eles derrubariam a sessao de todo mundo.
2. **Falha fechada.** Se o campo sumir por qualquer motivo, a sessao cai no
   ambiente que nao tem consequencia. O default seguro e TEST, e vai continuar
   sendo mesmo depois do rollout terminar.

**A consequencia que D1 e D2 juntos produzem, escrita para nao ser redescoberta
como bug** (verificada contra a API em `2026-09-08`): se o token e a copia e o
guard confia nela, entao trocar de ambiente **nao invalida o access token
anterior**. O refresh e revogado, mas o access e um JWT e nada o revoga em voo
-- ele segue lendo o ambiente antigo ate expirar, por ate 15 minutos.

Isso e tolerado, e nao ignorado. O cookie e substituido no browser inteiro
(`path: '/'`), entao nenhum cliente legitimo fica com o token velho; e o que um
token retido le e o ledger do proprio lojista, no ambiente que ele acabou de
deixar. Fechar a janela exige um guard com estado -- versao de sessao no
merchant ou epoch no Redis -- e uma leitura por request num caminho que hoje so
verifica assinatura.

**A regra que fica para quem precisar de mais que isso:** um caminho que *move
dinheiro* nao pode confiar no ambiente do token. Ele relê a loja na propria
chamada, como `CreatePaymentUseCase` faz. Foi assim que a habilitacao LIVE
ficou correta sem precisar revogar token nenhum, e e assim que o congelamento de
loja suspensa tem que ser construido.

`JwtStrategy` passa a devolver `environment` no objeto que anexa em
`request.user`, para parar de depender do `??` do decorator como unica cobertura.

**API key nao muda em nada.** Ela ja carrega o proprio ambiente
(`result.apiKey.environment`), e esse caminho nao encosta em `JwtPayload`.

## D3. `POST /auth/switch-environment`, no molde de `switch-store`

| Rota                            | Auth | Body                                |
| ------------------------------- | ---- | ----------------------------------- |
| `POST /auth/switch-environment` | JWT  | `{ environment: 'TEST' \| 'LIVE' }` |

O use case, na ordem que `SwitchStoreUseCase` ja estabeleceu:

1. Le a loja atual do merchant. Sem loja atual -> `NO_CURRENT_STORE`.
2. Se o destino e LIVE, exige `store.isLiveEnabled()`. Se nao ->
   `STORE_LIVE_NOT_ENABLED` (422, code que ja existe).
3. `merchant.setCurrentEnvironment(environment)` e persiste.
4. Revoga o refresh token anterior.
5. Re-emite o par, com o ambiente novo no payload.

O passo 4 e o que faz **trocar de ambiente invalidar a sessao anterior**. Nao e
acabamento: um token TEST ainda valido depois da troca para LIVE e uma sessao
que le o ledger errado sem que ninguem tenha pedido, e `switch-store` ja tratou
isso como invariante.

Trocar para TEST nunca e recusado. TEST e sempre permitido, em todos os cinco
estados de habilitacao -- e a promessa da fatia 3, e ela nao e negociada aqui.

## D4. Trocar de loja volta para TEST

`SwitchStoreUseCase` passa a chamar `merchant.setCurrentEnvironment(TEST)` junto
com `setCurrentStoreId`.

A habilitacao LIVE e um fato **da loja**. Carregar LIVE de uma loja aprovada
para uma que nunca pediu produziria uma sessao num estado que nenhuma regra
autoriza -- e o gate de D3 nem seria consultado, porque ninguem "trocou de
ambiente". O reset e a unica forma de a invariante valer sem um segundo lugar
onde checar.

Custo aceito: quem opera duas lojas em LIVE reseleciona a cada troca. E uma
troca a mais numa acao que ja re-emite tokens e recarrega a tela inteira.

## D5. O refresh reconfere a habilitacao, e degrada em vez de falhar

`RefreshTokenUseCase` ja le o merchant. Ele passa a ler tambem a loja atual, e:

```
currentEnvironment === LIVE  e  store.isLiveEnabled()   ->  re-emite em LIVE
currentEnvironment === LIVE  e  loja suspensa/rejeitada ->  re-emite em TEST,
                                                            e persiste TEST
qualquer outro caso                                     ->  re-emite em TEST
```

**O refresh nao falha quando a mesa suspende a loja.** Ele rebaixa a sessao para
TEST e grava isso no merchant.

E a mesma linha de raciocinio que fez o `SettlementJob` ser excecao na fatia 3:
uma consequencia de suspensao que **prende o usuario fora da propria sessao** e
pior do que a coisa que a suspensao pretende evitar. O lojista suspenso perde o
LIVE -- que e o ponto -- e continua entrando, vendo o TEST e lendo o motivo da
decisao em Settings, que e onde a fatia 3 ja o coloca.

Um `store.liveStatus` que muda enquanto o access token vive continua valendo por
ate 15 minutos. Isso ja e verdade hoje para `storeId` e para
`merchant.isActive`, e nao e uma janela que este PRD abre.

## D6. Saque e estorno em LIVE: quase nada a construir

O achado do inventario: os controllers **ja** encaminham o ambiente da request.

| Caminho                       | O que acontece quando a sessao vira LIVE                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| `POST /refunds`               | Funciona. `assertCallerCanMutateEnvironment` ja compara chamador e pagamento                 |
| `POST /withdrawals`           | Funciona. `create-withdrawal` ja reserva da conta do ambiente recebido                       |
| Worker processando saque LIVE | Ja funciona. `assertNotLiveEnvironment` so roda sob `input.simulation`, e o worker nao passa |
| `POST /bank-accounts`         | Store-scoped, sem ambiente. Nao muda                                                         |
| Acoes dev de saque            | **Muda.** Ver abaixo                                                                         |

O unico ajuste: as acoes de simulacao de saque
(`withdrawal-dev.controller`) hoje recusam LIVE por
`assertNotLiveEnvironment`. Elas passam a seguir a regra da fatia 3 --
**simular em LIVE exige loja `APPROVED`** -- porque e a mesma regra, pelo mesmo
motivo, e manter duas respostas diferentes para "posso simular em LIVE?" e
convidar a proxima pessoa a escolher a errada.

`assertNotLiveEnvironment` fica sem nenhum chamador depois disso. **Ela sai**, e
`LIVE_ENVIRONMENT_NOT_ALLOWED` passa a ter um significado so: chamador de um
ambiente mexendo em agregado de outro (`assertCallerCanMutateEnvironment`). Um
guard sem chamador e a proxima armadilha de nomes, como `allowLiveEnvironment`
ja foi na fatia 3.

**A regra que nao muda:** o saldo LIVE e simulado. Sacar em LIVE nao tira
dinheiro de lugar nenhum, e a tela diz isso no proprio formulario de saque --
nao so no rodape da pagina de saldo.

## D7. O seletor na tela, e o que ele nao pode parecer

O seletor vive no `dashboard-layout`, visivel em toda tela do dashboard, porque
saldo, extrato, pagamento, produto e chave mudam de significado com ele. Um
seletor escondido em Settings seria um estado global controlado de um lugar que
ninguem visita.

Tres regras de forma:

1. **LIVE aparece marcado como simulado onde ele aparecer.** No seletor, no
   saldo, e no formulario de saque. O projeto inteiro e construido em nao
   mentir sobre isso, e um badge "LIVE" identico ao de um gateway real seria a
   mentira mais cara que o simulador consegue contar.
2. **Loja sem habilitacao nao consegue selecionar LIVE.** A opcao aparece
   desabilitada, com o estado atual (`PENDING`, `REJECTED`, `SUSPENDED`,
   `NOT_REQUESTED`) e um caminho para Settings -- nao escondida. Ver a porta
   fechada e como o lojista descobre que ela existe, e e o que a fatia 3 existe
   para ensinar.
3. **A troca recarrega o estado, nao filtra o que ja estava na tela.** A troca
   re-emite tokens; tratar o resultado como um filtro de cliente deixaria dado
   de um ambiente na tela do outro por um instante -- que e exatamente a
   confusao que a fatia 2 separou o ledger para evitar.

## Erros

**Nenhum code novo.** Reusados:

| Code                     | HTTP | Quando                                                       |
| ------------------------ | ---- | ------------------------------------------------------------ |
| `STORE_LIVE_NOT_ENABLED` | 422  | Selecionar LIVE numa loja cujo `liveStatus` nao e `APPROVED` |
| `NO_CURRENT_STORE`       | 403  | Trocar de ambiente sem loja no contexto da sessao            |

`environment` fora de `TEST | LIVE` e `400` de validacao de DTO.

Sai do codigo: `assertNotLiveEnvironment` (D6). O code
`LIVE_ENVIRONMENT_NOT_ALLOWED` **fica**, com o significado que ja era o
principal.

## Migration

```sql
ALTER TABLE "merchants"
  ADD COLUMN "current_environment" "Environment" NOT NULL DEFAULT 'TEST';
```

O enum `Environment` ja existe no schema. Sem backfill: `TEST` para todo
merchant existente e exatamente o que e verdade hoje -- toda sessao JWT e TEST,
por linha de codigo.

## Nao-objetivos

- **A mesa.** Condicao comercial, leitura cross-merchant e tela de operador
  vivem em [PRD_OPERATOR_DESK.md](PRD_OPERATOR_DESK.md).
- **LIVE deixar de ser simulado.** Continua nao havendo adquirente. O seletor
  troca de ledger, nao de realidade.
- **Ambiente por aba ou por request.** Uma sessao tem um ambiente. Um header
  `X-Environment` que sobrepoe o token seria um segundo caminho de
  autorizacao, e o projeto acabou de gastar tres fatias tendo um so.
- **Lembrar o ambiente por loja.** `currentEnvironment` e do merchant, e D4
  reseta na troca. Um mapa loja -> ambiente e produto proprio.
- **Notificar o lojista** do rebaixamento de D5. Ele ve o estado e o motivo em
  Settings, como a fatia 3 decidiu.
- **Logout de merchant que nao revoga o refresh token no banco.** Achado de
  `2026-09-06`, ainda em aberto, e nao piora com esta passagem.
- **Ambiente na sessao de operador.** A mesa escolhe o ambiente por consulta,
  nao por sessao -- decidido em D8 do PRD da mesa.

## Criterios de aceite

- Dashboard em LIVE mostra o ledger LIVE e nunca mistura com o TEST -- provado
  por teste que credita os dois e le os dois.
- Trocar de ambiente invalida a sessao anterior, como `switch-store` ja faz --
  provado por teste que usa o token antigo depois da troca.
- Loja sem habilitacao LIVE nao consegue selecionar LIVE:
  `STORE_LIVE_NOT_ENABLED`, provado nos quatro estados que nao sao `APPROVED`.
- Trocar de loja volta para TEST, mesmo vindo de uma sessao LIVE.
- Refresh preserva o ambiente da sessao; refresh de merchant cuja loja foi
  suspensa **rebaixa para TEST e nao falha**, e persiste o rebaixamento.
- Token sem o campo `environment` continua sendo TEST, nao um erro.
- Saque e estorno em LIVE saem do ledger LIVE e nao encostam no TEST.
- Acao dev de saque em LIVE de loja nao habilitada e recusada com
  `STORE_LIVE_NOT_ENABLED`, nao com `LIVE_ENVIRONMENT_NOT_ALLOWED`.
- `grep -r assertNotLiveEnvironment` nao acha nada em `apps` nem em
  `packages/*/src`.
- A tela diz que LIVE e simulado no seletor, no saldo e no formulario de saque.
- API key continua carregando o proprio ambiente, sem passar por nada disto.
- `CURRENT_STATE.md` fecha os dois gaps: "Dashboard nao tem seletor TEST/LIVE" e
  "Saque e estorno so alcancam o ledger TEST".

## Ordem de implementacao

Dois PRs. O primeiro termina com o ambiente selecionavel e o dashboard lendo o
ledger certo; o segundo e o que a selecao destrava.

### PR 1 -- a sessao passa a saber o ambiente

1. Migration (`merchants.current_environment`), `Merchant.currentEnvironment` e
   `setCurrentEnvironment`.
2. `environment` no `JwtPayload`; os quatro pontos de emissao lendo o merchant.
3. Guard e `JwtStrategy` lendo o campo, com o fallback TEST de D2.
4. `POST /auth/switch-environment`, com o gate de habilitacao.
5. `SwitchStoreUseCase` resetando para TEST (D4); `RefreshTokenUseCase`
   reconferindo e degradando (D5).
6. Seletor no `dashboard-layout`, com LIVE marcado como simulado e desabilitado
   sem habilitacao.

### PR 2 -- saque e estorno em LIVE

7. Acoes dev de saque trocando `assertNotLiveEnvironment` por
   `assertLiveSimulationAllowed`; remocao do guard sem chamador.
8. Testes de isolamento lendo as duas contas em saque e estorno.
9. Tela: LIVE simulado no formulario de saque.
10. Docs: `CURRENT_STATE.md` e `PRODUCT.md`.

## Riscos

| Risco                                           | Como aparece                                            | O que segura                                                                        |
| ----------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `environment` no token sem checar habilitacao   | Loja nao habilitada operando em LIVE                    | D3: o gate esta no use case de troca, nao na tela                                   |
| Loja suspensa derrubando a sessao no refresh    | Lojista sem conseguir entrar, sem entender por que      | D5: rebaixa para TEST em vez de falhar, com teste                                   |
| Ambiente carregado na troca de loja             | Sessao LIVE numa loja que nunca pediu habilitacao       | D4: reset para TEST, com teste que troca de loja vindo de LIVE                      |
| Fallback `?? TEST` mascarando um bug de emissao | Sessao silenciosamente em TEST achando que esta em LIVE | A resposta de `switch-environment` devolve o ambiente; a tela mostra qual e         |
| Seletor tratado como filtro de cliente          | Dado de um ambiente na tela do outro                    | D7.3: a troca recarrega o estado                                                    |
| 14 controllers lendo `CurrentEnvironment`       | Um caminho esquecido continuando TEST                   | O decorator nao muda: quem muda e o que o guard escreve. Nenhum controller e tocado |
| Formatar com `pnpm run format` na raiz          | 413 arquivos de churn que o gate de CI nao pega         | Achado de `2026-09-07`: formatar por pacote                                         |

## O que reabre estas decisoes

- **Adquirente de verdade** -> LIVE para de ser simulado, D7 muda de
  significado, e sacar em LIVE deixa de ser reversivel por `pnpm db:reset`.
- **Papeis dentro do merchant** -> quem pode selecionar LIVE deixa de ser "todo
  mundo que entra" e vira permissao.
- **Mais de duas lojas em LIVE por merchant** -> o reset de D4 vira atrito real,
  e o mapa loja -> ambiente sai dos nao-objetivos.
- **Sessao longa ou token de vida maior** -> a janela de 15 minutos de D5 deixa
  de ser desprezivel e a suspensao precisa de revogacao ativa.
