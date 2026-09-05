# PRD - Fronteira de autorizacao de operador

> **Status: proposta. Nada descrito aqui existe no runtime.**
> Este documento detalha a **fatia 1** do
> [PRD - Superficie de operador](PRD_OPERATOR_SURFACE.md). Enquanto a Matriz de
> Maturidade do [CURRENT_STATE.md](CURRENT_STATE.md) nao tiver a linha
> correspondente, tudo abaixo e intencao.

Last reviewed: `2026-09-05`
Nao depende de: ledger por ambiente (fatia 2). As duas podem ser construidas em qualquer ordem.

## O que esta fatia entrega

Um segundo principal no sistema -- `Operator` -- com tabela propria, caminho de
autenticacao proprio e trilha de auditoria append-only.

Nenhum poder de operador entra aqui. Nao aprova loja, nao muda taxa, nao le dado
de outra loja. Entra a **fronteira**, e a prova por teste de que ela nao vaza nos
dois sentidos.

O criterio de sucesso e desconfortavel de proposito: no fim desta fatia o produto
faz exatamente o que fazia antes. O que muda e que passa a existir um lugar onde
poder pode ser adicionado sem virar backdoor.

## Por que a fronteira antes do poder

Duas razoes, e as duas ja estao no PRD pai:

1. **Modelo de principal errado contamina tudo.** Guard, token, query e migration
   passam a depender dele. Corrigir depois custa mais do que acertar antes.
2. **Poder sem rastro deixa o sistema pior do que esta.** Hoje ninguem pode mudar
   a taxa de uma loja. Isso e melhor do que alguem poder mudar sem registro.

## Estado atual que esta fatia toca

| Onde                                                      | Fato de hoje                                                                    | O que muda                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `packages/database/prisma/schema.prisma`                  | `Merchant` e `RefreshToken` (um token ativo por merchant, `merchantId @unique`) | Ganha `Operator`, `OperatorRefreshToken` e `OperatorAuditLog` |
| `packages/core/src/application/ports/jwt-service.port.ts` | `JwtPayload` e `{ sub, storeId?, iat?, exp? }` -- **sem audiencia**             | Ganha `aud`                                                   |
| `apps/api/src/infra/services/jwt.service.ts`              | Assina HS256 com `JWT_SECRET` unico, sem `aud`                                  | Assina com audiencia; operador usa segredo proprio            |
| `apps/api/src/modules/auth/strategies/jwt.strategy.ts`    | Le `hockpay_at` e aceita qualquer token valido que tenha `sub`                  | Rejeita audiencia diferente de `merchant`                     |
| `apps/api/src/modules/auth/guards/combined-auth.guard.ts` | Aceita API key **ou** JWT de merchant                                           | Rejeita token de operador antes de olhar store                |
| `apps/api/src/app.module.ts`                              | `JwtAuthGuard` global (`APP_GUARD`); unica saida e `@Public()`                  | Ganha caminho explicito para rota de operador (ver D4)        |
| `apps/api/src/common/request-id.ts`                       | `getOrCreateRequestId` ja existe e ja circula por request                       | Vira campo da trilha                                          |
| `packages/database/package.json`                          | `db:seed` aponta para `prisma/seed.ts`, **que nao existe**                      | A CLI de provisionamento nao se apoia nesse script            |

## Decisoes

### D1. Tabela propria, sem relacao com `Merchant`

```
Operator              { id, email @unique, passwordHash, name, isActive, createdAt, updatedAt }
OperatorRefreshToken  { id, token @unique, operatorId @unique, expiresAt, revokedAt, createdAt, updatedAt }
```

`OperatorRefreshToken` espelha `RefreshToken`, inclusive o `@unique` no dono: um
token ativo por operador. Nao existe FK entre `Operator` e `Merchant`/`Store`, e
nao existe coluna que ligue os dois.

**Nao existe papel dentro do operador nesta fatia.** Todo operador e o mesmo
operador. Granularidade de permissao so faz sentido quando ha mais de um poder
para separar; com zero poderes, um enum de `role` seria adivinhacao -- e
adivinhacao em modelo de authz e exatamente o que este PRD existe para evitar.

### D2. Audiencia no token e segredo proprio

`JwtPayload` ganha `aud: 'merchant' | 'operator'`, obrigatorio na emissao e
verificado na entrada.

Audiencia sozinha ja separaria, **desde que** toda verificacao passasse pelo
mesmo lugar. Nao passa: hoje existem dois caminhos de verificacao (`JwtStrategy`
e `CombinedAuthGuard`), e havera um terceiro. Por isso o operador tambem ganha
segredo proprio (`OPERATOR_JWT_SECRET`): com segredos distintos, um token de
merchant **nao verifica** numa rota de operador nem se alguem esquecer a checagem
de `aud`. A fronteira volta a ser estrutural em vez de condicional.

`aud` continua valendo a pena junto do segredo: torna o token legivel em log e em
debug, e deixa a intencao explicita no payload.

A API ja falha no boot quando `JWT_SECRET` falta. `OPERATOR_JWT_SECRET` segue a
mesma regra -- sem fallback silencioso para o segredo de merchant.

### D3. Cookies e caminho proprios

| Cookie          | Path                            | TTL    |
| --------------- | ------------------------------- | ------ |
| `hockpay_op_at` | `/api/v1/operator`              | 15 min |
| `hockpay_op_rt` | `/api/v1/operator/auth/refresh` | 7 dias |

Nomes distintos, e nao o mesmo nome em outro path: o mesmo browser pode ter as
duas sessoes abertas, e cookie homonimo em paths diferentes e ambiguidade que o
servidor nao resolve. As opcoes de cookie (`httpOnly`, `secure` em producao,
`sameSite: strict`) sao as mesmas do merchant.

### D4. O guard global precisa saber que a rota nao e de merchant

`JwtAuthGuard` e `APP_GUARD` e a unica saida hoje e `@Public()`. Marcar rota de
operador como publica seria mentir no codigo -- a rota **exige** autenticacao,
so que de outro principal.

Proposta: decorator `@OperatorRoute()` com metadata propria. `JwtAuthGuard` ve a
marca e devolve `true` sem autenticar (delega); `OperatorAuthGuard`, aplicado no
controller de operador, faz a autenticacao real.

O risco obvio dessa forma e uma rota futura marcada como `@OperatorRoute()` e sem
`OperatorAuthGuard` -- que ficaria aberta. Por isso o teste de varredura de rotas
e criterio de aceite, e nao acabamento: ele enumera as rotas sob `/operator` e
falha se alguma nao tiver o guard.

A alternativa -- trocar o guard global por um dispatcher que escolhe o principal
pelo prefixo -- e mais limpa no papel e mexe em toda rota autenticada da API.
Fica fora desta fatia por tamanho, nao por preferencia.

### D5. API key nunca autentica operador

`CombinedAuthGuard` nao entra em rota de operador, em nenhuma configuracao. Nao
existe caminho de `ApiKey` que chegue a `Operator`, e nao existe API key de
operador -- nem em TEST. Integracao programatica com a mesa nao esta em escopo.

### D6. Provisionamento por CLI, nao por cadastro

```
pnpm operator:create --email <email> --name <nome>
```

Senha lida por prompt/stdin, nunca por `argv` (argumento vaza em historico de
shell e em lista de processos). Hash com argon2, reusando `IPasswordHasherPort` --
o mesmo caminho do merchant.

Sem rota publica de cadastro e sem operador default criado no boot: um operador
provisionado automaticamente e uma credencial conhecida.

O script `db:seed` aponta para um arquivo que nao existe. A CLI nova nao herda
esse caminho; remover o script morto cabe na mesma passagem.

## Trilha de auditoria

```
OperatorAuditLog { id, operatorId, action, targetType, targetId?, before Json?,
                   after Json?, reason?, requestId?, createdAt }
```

Indices: `createdAt desc`, `operatorId`, `(targetType, targetId)`.

Regras que definem a trilha:

- **Append-only na interface.** `IOperatorAuditLogRepository` expoe `append()` e
  leitura. Nao existe `update` nem `delete` na porta -- nao como convencao, como
  ausencia de metodo.
- **So alcancavel pela transacao.** O repositorio entra em
  `ITransactedRepositories` e **nao** e registrado como provider avulso. Assim a
  unica forma de escrever na trilha e dentro do `UnitOfWork` que faz a mudanca
  que ela descreve. Auditoria que pode falhar sozinha registra uma historia
  diferente da que aconteceu.
- **`reason` e regra de use case, nao de coluna.** Nesta fatia nenhuma acao tem
  consequencia financeira, entao a coluna e opcional. A obrigatoriedade nasce com
  o primeiro poder que mexe em dinheiro do lojista (fatia 4).
- **`requestId` vem de `getOrCreateRequestId`**, ligando a linha da trilha ao log
  da request.

**O que ja e auditado aqui: login e logout de operador.** Nao e decoracao -- e o
que prova o caminho de escrita ponta a ponta e o que da conteudo a leitura antes
de existir qualquer poder.

Falha de login nao gera linha (nao ha principal identificado, e email digitado
errado nao e evento de auditoria). Contra forca bruta continua valendo o
throttle de login, o mesmo limite ja aplicado em `/auth/login`.

Retencao e purga ficam fora desta fatia. Trilha append-only cresce para sempre;
num simulador local isso e aceitavel, e a decisao fica registrada em vez de
esquecida.

## Superficie HTTP desta fatia

| Rota                          | Auth                  | O que faz                                     |
| ----------------------------- | --------------------- | --------------------------------------------- |
| `POST /operator/auth/login`   | publica, com throttle | Autentica e emite os dois cookies de operador |
| `POST /operator/auth/refresh` | `hockpay_op_rt`       | Rotaciona o par de tokens                     |
| `POST /operator/auth/logout`  | operador              | Revoga o refresh token e limpa cookies        |
| `GET /operator/me`            | operador              | `id`, `name`, `email`                         |
| `GET /operator/audit-logs`    | operador              | Trilha paginada, ordem decrescente            |

Nenhuma rota desta fatia le dado de loja, de pagamento ou de ledger.

## Erros

Reusa o catalogo existente: `INVALID_CREDENTIALS` (401), `INVALID_REFRESH_TOKEN`
(401), `REFRESH_TOKEN_REVOKED` (401), `TOKEN_EXPIRED` (401). Entra um code novo:

| Code                | HTTP | Quando                              |
| ------------------- | ---- | ----------------------------------- |
| `OPERATOR_INACTIVE` | 403  | Operador existe, `isActive = false` |

Cruzamento de principal e **401, nao 403**: token de merchant em rota de operador
(e vice-versa) nao e um principal conhecido sem permissao suficiente -- e um
principal que aquela porta nao reconhece.

## Migration e tokens em voo

A migration cria tres tabelas e **nao altera nenhuma existente**. Nao ha backfill.

`aud` obrigatorio invalida todo `hockpay_at` emitido antes do deploy. O custo real
e pequeno: o access token vive 15 minutos e o refresh reemite. Nao vale abrir a
condicional "aceita token sem `aud` por um periodo" -- ela e exatamente o buraco
que esta fatia existe para fechar.

## Nao-objetivos desta fatia

- **Qualquer poder de operador**: aprovar loja, suspender, mexer em taxa, ler
  dado de outra loja. Fatias 3 a 5.
- **Tela.** Nenhuma rota nova em `apps/web`. A trilha e lida por API aqui; a
  visibilidade na superficie de operador vem com a superficie.
- **Papeis e permissoes granulares** dentro de `Operator` (ver D1).
- **MFA.** Um gateway real tem; um simulador com provisionamento por CLI local,
  nao precisa para ser crivel. Reabre se a instancia virar hospedada.
- **Impersonacao.** Adiada por decisao no PRD pai.
- **Ledger por ambiente.** Fatia 2, independente desta.
- **Retencao/purga da trilha.**

## Criterios de aceite

- Token de merchant recebe 401 em qualquer rota `/operator`; token de operador
  recebe 401 na `JwtStrategy` e no `CombinedAuthGuard`. Verificado por teste, nao
  por inspecao.
- API key recebe 401 em qualquer rota `/operator`, em TEST e em LIVE.
- Toda rota sob `/operator` tem `OperatorAuthGuard`, provado por teste de
  varredura de rotas -- nao por revisao de PR.
- `IOperatorAuditLogRepository` nao tem `update` nem `delete`, e o repositorio so
  e alcancavel por `ITransactedRepositories`.
- Login e logout de operador aparecem em `GET /operator/audit-logs` com
  `requestId` preenchido.
- Nenhum comportamento de merchant muda, exceto a invalidacao de tokens sem
  `aud`.
- `CURRENT_STATE.md` ganha a linha na Matriz de Maturidade (superficie de
  operador: fronteira e trilha, sem poder), a linha correspondente na Matriz de
  Superficies, e a secao de autenticacao passa a descrever os dois principais.
- CI verde: `lint:check`, `format:check`, `build`, testes de core, infrastructure,
  api, worker e web, e `api-e2e`.

## Ordem de implementacao

Cada passo e um commit; os dois primeiros sao os que pedem revisao mais dura.

1. Schema + migration (`Operator`, `OperatorRefreshToken`, `OperatorAuditLog`),
   ainda sem uso.
2. `aud` no `JwtPayload`/`JwtService`, `OPERATOR_JWT_SECRET`, e rejeicao de
   audiencia na `JwtStrategy` e no `CombinedAuthGuard`.
3. Portas e repositorios (operador, refresh token de operador, trilha
   append-only) e entrada no `UnitOfWork`.
4. Use cases de login/refresh/logout de operador, espelhando os de merchant e
   gravando a trilha na mesma transacao.
5. Controller de operador, `OperatorAuthGuard`, `@OperatorRoute()` e o teste de
   varredura de rotas.
6. `GET /operator/me` e `GET /operator/audit-logs`.
7. CLI `operator:create` (e remocao do `db:seed` morto).
8. Docs: `CURRENT_STATE.md`, `apps/api/README.md`, `.env.example` e `RUNBOOK.md`
   com a variavel nova.

## Riscos

| Risco                                             | Como aparece                              | O que segura                                                          |
| ------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| Rota de operador futura sem guard                 | Endpoint aberto, sem erro visivel         | Teste de varredura de rotas (criterio de aceite)                      |
| Trilha escrita fora da transacao num poder futuro | Mudanca aplicada sem linha correspondente | Repositorio so existe dentro de `ITransactedRepositories`             |
| `OPERATOR_JWT_SECRET` ausente em deploy           | Boot falha                                | E o comportamento desejado -- sem fallback para o segredo de merchant |
| Sessoes de merchant caem no deploy do `aud`       | Relogin em ate 15 min                     | Aceito e documentado                                                  |

## O que reabre estas decisoes

- **Mais de um perfil de operador com poderes distintos** -> papeis dentro de
  `Operator` deixam de ser adivinhacao (D1).
- **Instancia hospedada e multiusuario de verdade** -> MFA e retencao da trilha
  deixam de ser opcionais.
- **Integracao programatica com a mesa** -> credencial de servico para operador,
  hoje explicitamente fora (D5).
