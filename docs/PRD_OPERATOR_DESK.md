# PRD - A mesa vira mesa

> **Status: proposta. Nada descrito aqui existe no runtime.**
> Este documento detalha as **fatias 4 e 5** do
> [PRD - Superficie de operador](PRD_OPERATOR_SURFACE.md), mais a tela que
> torna as tres primeiras fatias operaveis. Ele nao descreve o sistema atual --
> para isso, [CURRENT_STATE.md](CURRENT_STATE.md).

Last reviewed: `2026-09-07`
Depende de: [fronteira de autorizacao](PRD_OPERATOR_AUTHZ.md) (fatia 1, implementada), [ledger por ambiente](PRD_ENVIRONMENT_LEDGER.md) (fatia 2, implementada) e [onboarding LIVE](PRD_LIVE_ONBOARDING.md) (fatia 3, implementada)

## O que este documento entrega

Tres coisas, e elas estao num PRD so porque respondem a mesma pergunta:

1. **Condicao comercial** (fatia 4) -- `feePercent`, `feeFixed` e
   `settlementDays` ganham caminho de escrita, com motivo e trilha.
2. **Leitura para investigar chamado** (fatia 5) -- o operador le pagamento,
   ledger, transacao, timeline e entrega de webhook de qualquer loja, sem
   tocar em credencial.
3. **A tela** -- sessao de operador em `apps/web`, com fila, decisao, condicao
   comercial, trilha e investigacao.

Separa-las em tres PRDs seria cerimonia: sao a mesma decisao de produto
("a mesa deixa de ser `curl`") vista de tres angulos, e a terceira nao tem
conteudo sem as duas primeiras.

**O que fica fora deste PRD:** o seletor de ambiente do lojista, que e outro
principal e outra pergunta -- vive em
[PRD_ENVIRONMENT_SELECTOR.md](PRD_ENVIRONMENT_SELECTOR.md). E a fatia 6
(antifraude), que o PRD pai coloca depois da fila de revisao existir.

## O estado que este documento toca

| Onde                                                                                                                     | Fato de hoje                                                                          |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `packages/core/.../store.entity.ts`                                                                                      | `_feePercent`, `_feeFixed` e `_settlementDays` sao `private readonly`                 |
| `Store.create`                                                                                                           | Defaults `1.5%`, `15` centavos, `30` dias. Nenhum caminho os muda depois              |
| `create-payment.use-case.ts:238`                                                                                         | `FeePolicy.calculate({ feePercent: store.feePercent, ... })` no momento da cobranca   |
| `payment.fee` / `payment.netAmount`                                                                                      | Gravados na criacao. Ja sao snapshot                                                  |
| `list-stores.use-case.ts:57`                                                                                             | O lojista **ja ve** `feePercent` em `GET /stores`                                     |
| `OPERATOR_AUDIT_ACTION`                                                                                                  | `LOGIN`, `LOGOUT`, `STORE_LIVE_APPROVED\|REJECTED\|SUSPENDED`                         |
| `OperatorStoreController`                                                                                                | So `GET /operator/stores` (fila) e `POST /operator/stores/:id/live-status`            |
| `operator-routes.spec.ts`                                                                                                | Varredura por reflexao: todo controller do modulo e `@OperatorRoute()` e guardado     |
| `list-payments`, `get-account`, `list-transactions`, `get-payment-timeline`, `list-webhook-logs`, `list-webhook-configs` | Ja existem, ja sao store-scoped, e todos recebem `environment` como input obrigatorio |
| `WebhookConfig`                                                                                                          | `_secret` guardado encriptado; `toObject()` inclui, `toPublicObject()` nao            |
| `apps/web/src/app/core/guards/`                                                                                          | `auth.guard.ts` e `guest.guard.ts`, os dois de merchant                               |
| `apps/web/src/app/shared/layouts/`                                                                                       | `public-layout`, `auth-layout`, `dashboard-layout`. Nada de operador                  |

Dois achados que mudam o plano:

- **Nao ha o que migrar em condicao comercial.** Os tres campos ja existem no
  schema com default e ja sao lidos por `FeePolicy`. A fatia 4 e caminho de
  escrita, nao modelagem nova. Nao ha migration.
- **As seis leituras da fatia 5 ja aceitam qualquer `storeId`.** Elas sao
  store-scoped por parametro, nao por sessao -- quem amarra ao merchant e o
  controller, que le `request.store.id`. Expor por um caminho de operador e
  trocar a origem do `storeId`, nao alargar a leitura.

---

# Parte 1 - Condicao comercial (fatia 4)

## D1. Os tres campos mudam juntos, por um metodo com regra

`Store` ganha um metodo, nao tres setters:

```ts
updateCommercialTerms(input: {
  feePercent: number;
  feeFixed: number;
  settlementDays: number;
}): void
```

Os tres sao obrigatorios. **Nao existe mudanca parcial**, e a razao e a trilha:
um `before`/`after` que so carrega o campo alterado obriga quem le a
reconstruir a condicao inteira juntando linhas antigas. Condicao comercial e
um objeto, e a mesa decide o objeto.

O metodo valida faixa e so entao muda estado, como `transitionLive` faz. Nao
existe caminho para um valor fora de faixa passar por um setter que ninguem
lembrou de checar -- que e exatamente o erro que `liveStatus` evitou na fatia 3.

## D2. Faixa, e o que ela protege

| Campo            | Faixa aceita | Por que este limite                                                                                                              |
| ---------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `feePercent`     | `0` a `10`   | Zero e uma condicao real (loja de demonstracao). Acima de 10% nao e negociacao, e erro de digitacao com consequencia financeira. |
| `feeFixed`       | `0` a `1000` | Centavos. R$ 10,00 de teto pelo mesmo motivo.                                                                                    |
| `settlementDays` | `0` a `90`   | Inteiro. Zero e liquidacao imediata; 90 e o horizonte que o `SettlementJob` consegue explicar.                                   |

`feePercent` aceita casa decimal (`1.5` e o default de hoje); `feeFixed` e
`settlementDays` sao inteiros. Valor fora de faixa, `NaN`, negativo ou
`settlementDays` fracionario e recusado pela **entidade**, com
`INVALID_COMMERCIAL_TERMS` (422, categoria `BUSINESS`).

Os limites sao do simulador, nao do mercado. Eles existem para que um erro de
digitacao na mesa nao vire uma taxa de 150% em toda cobranca futura da loja --
que e o unico dano que esta fatia consegue causar.

## D3. A mudanca nao alcanca o passado, e isso ja e verdade

`Payment.fee` e `Payment.netAmount` sao calculados por `FeePolicy` na criacao e
gravados na linha. Nenhuma leitura recalcula. Entao a nao-retroatividade nao
precisa ser construida -- precisa ser **provada**, e o criterio de aceite pede o
teste: cobrar, mudar a taxa, e reler o pagamento antigo com o `fee` intacto.

`settlementDays` e diferente e merece ser dito em voz alta: ele e lido pelo
`SettlementJob` no momento de liberar, nao no de cobrar. Mudar de 30 para 2 dias
**antecipa a liberacao de pagamentos que ja estao em `pending`**. Isso e o
comportamento correto (o prazo e uma promessa da loja, nao do pagamento), mas e
uma diferenca real em relacao a taxa, e a tela precisa dizer.

## D4. `POST /operator/stores/:id/commercial-terms`

| Rota                                         | Auth     | Body                                               |
| -------------------------------------------- | -------- | -------------------------------------------------- |
| `POST /operator/stores/:id/commercial-terms` | operador | `{ feePercent, feeFixed, settlementDays, reason }` |

`reason` e obrigatorio e validado **no use case**, nao so no DTO -- pela mesma
razao de D6 da fatia 3: um cliente HTTP direto nao passa pela tela. Reusa
`OperatorDecisionReasonRequiredError`, que ja existe e ja tem code no catalogo.

A resposta devolve a loja com a condicao nova. Nao devolve ledger, pagamento
nem credencial: a regra da fila da fatia 3 vale aqui.

## D5. Uma acao nova na trilha, com os tres valores dos dois lados

```ts
STORE_COMMERCIAL_TERMS_CHANGED: 'store.commercial_terms_changed',
```

```json
{
  "targetType": "store",
  "targetId": "<store id>",
  "before": { "feePercent": 1.5, "feeFixed": 15, "settlementDays": 30 },
  "after": { "feePercent": 2.9, "feeFixed": 39, "settlementDays": 2 },
  "reason": "...",
  "requestId": "..."
}
```

Escrita no mesmo `unitOfWork.execute` que muda a loja, que e o que a fatia 1
tornou estrutural. Uma mudanca de condicao comercial sem linha na trilha nao e
um bug de implementacao aqui -- e um caminho que nao existe.

## D6. O lojista continua vendo, e nao e notificado

`GET /stores` ja devolve `feePercent`. Ele passa a devolver os tres, e a tela
de settings passa a mostra-los como leitura -- e a coerencia minima: uma taxa
que muda sem o lojista conseguir ver qual e seria pior do que a imutabilidade
de hoje.

**Notificacao fica fora.** Evento de ciclo de vida de loja (`store.updated`) e
catalogo proprio, com envelope, versao e entrada em [EVENTS.md](EVENTS.md).
Mesma decisao que a fatia 3 tomou para a decisao de habilitacao.

---

# Parte 2 - Leitura para investigar chamado (fatia 5)

## D7. As rotas espelham as de merchant, com o `storeId` vindo do path

| Rota                                                    | Reusa                       |
| ------------------------------------------------------- | --------------------------- |
| `GET /operator/stores/:id`                              | (novo) detalhe da loja      |
| `GET /operator/stores/:id/payments`                     | `ListPaymentsUseCase`       |
| `GET /operator/stores/:id/payments/:paymentId/timeline` | `GetPaymentTimelineUseCase` |
| `GET /operator/stores/:id/account`                      | `GetAccountUseCase`         |
| `GET /operator/stores/:id/transactions`                 | `ListTransactionsUseCase`   |
| `GET /operator/stores/:id/webhooks`                     | `ListWebhookConfigsUseCase` |
| `GET /operator/stores/:id/webhooks/logs`                | `ListWebhookLogsUseCase`    |

Os use cases **nao mudam**. Eles ja recebem `storeId` como parametro; o que
muda e a origem: `request.store.id` (merchant) vira `params.id` (operador).

Isso e o ponto da fatia, e vale registrar: nao existe use case novo de leitura
de operador. Um caminho de leitura paralelo, com sua propria nocao de o que
devolver, e como um segundo lugar onde o vazamento pode nascer. O operador le
**exatamente o que o lojista le**, de uma loja que ele escolhe.

Consequencia que aceito de olhos abertos: `GET /operator/stores/:id/webhooks`
devolve o que `ListWebhookConfigsUseCase` devolve, que sao entidades
`WebhookConfig`. O controller serializa por `toPublicObject()`, e D10 e o teste
que impede a proxima pessoa de serializar por `toObject()`.

## D8. `environment` e obrigatorio, e nao tem default

As leituras que sao por ambiente -- payments, timeline, ledger e transacoes --
exigem `environment`. O merchant resolve isso pela sessao (hoje sempre TEST).
**O operador nao tem sessao com ambiente** -- ele nao opera uma loja, ele
investiga varias.

Entao: `?environment=TEST|LIVE`, obrigatorio, e ausente ou invalido e `400`.

**As duas rotas de webhook ficam de fora**, e isso nao e excecao: `WebhookConfig`
e `WebhookLog` sao escopados por loja e nao tem coluna de ambiente. Exigir um
parametro que a rota depois ignora seria a mesma classe de mentira pequena que
o resto deste D8 existe para evitar.

A alternativa -- `?? TEST` como o guard de merchant faz -- foi descartada. Um
operador investigando um chamado de producao que recebe silenciosamente o
ledger TEST tira a conclusao errada com dado certo, e nada na resposta diz que
ele olhou o ambiente errado. Um `400` custa uma linha de curl; uma investigacao
errada custa a credibilidade da mesa.

## D9. Segredo nao sai, e a fronteira e a serializacao

O PRD pai e explicito: _"Secret de webhook e chave de API continuam invisiveis,
inclusive para operador. Suporte investiga entrega e log, nao credencial."_

- Nao existe rota de operador para API keys. Nao e "filtrada" -- ela nao
  existe.
- `WebhookConfig` sai por `toPublicObject()`, que ja exclui `secret` e mantem
  `prefix` (identificacao sem exposicao). A propriedade ja e em boa parte
  estrutural; falta o teste que prova.
- `WebhookLog` carrega payload e headers de entrega. **A assinatura HMAC
  enviada e um header** -- ela nao e o secret, e nao permite deriva-lo, entao
  fica. O que nao pode aparecer e o secret em claro em lugar nenhum.

## D10. A varredura descobre as rotas por reflexao, nao por lista

Este e o criterio de aceite mais importante da fatia, e o mecanismo importa
mais do que o resultado de hoje: **uma lista de rotas escrita a mao passa a
mentir na primeira rota nova**.

O teste, no formato que `operator-routes.spec.ts` ja estabeleceu:

1. Descobre por reflexao toda rota `GET` registrada nos controllers do
   `OperatorModule`.
2. Contra uma loja semeada que tem API key e webhook config com secret
   conhecido, chama cada uma.
3. Falha se a resposta serializada contiver o valor do secret plantado, o valor
   da chave plantada, ou qualquer chave chamada `secret`, `hashedKey`,
   `plainKey` ou `hashedSecret` -- em qualquer profundidade, e atravessando
   `toObject()` das entidades que chegarem inteiras na resposta.

O arquivo e `apps/api/src/modules/operator/operator-read-no-secrets.spec.ts`.
Ele carrega dois testes que provam que a varredura serve para alguma coisa: um
que a faz falhar com a forma exata que um `toObject()` descuidado produz, e um
que garante que ela **nao** acusa a assinatura HMAC do header de entrega, que
nao e o secret.

Rota nova entra na varredura sozinha. Rota nova que vaza quebra o build, e nao
a revisao de alguem.

## D11. Abrir a loja e o que entra na trilha, e o GET escreve

Decidido em `2026-09-07`. A trilha registra **uma linha por investigacao
aberta**, nao uma por request de leitura:

```ts
STORE_INVESTIGATED: 'store.investigated',
```

`GET /operator/stores/:id` -- o detalhe da loja, que e o ponto de entrada de
qualquer investigacao -- grava a linha. As sub-leituras (payments, ledger,
transactions, timeline, webhooks) sao puras e nao gravam nada.

**Um `GET` que escreve e uma excecao deliberada, e a alternativa e pior.** Um
`POST /operator/stores/:id/investigate` separado produz uma trilha que registra
so quem foi educado: o curl pula, e a tela chama duas vezes o que e uma acao
so. Um rastro que depende de boa vontade nao e rastro.

**Sem deduplicacao.** Recarregar a pagina grava outra linha. Deduplicar exigiria
ler a trilha para decidir se escreve -- e uma linha de auditoria condicional a
uma consulta e uma linha que da para argumentar que nao devia existir. A trilha
e append-only; duas linhas iguais em seguida sao a verdade sobre o que
aconteceu.

O limite honesto: um operador que chama `GET /operator/stores/:id/payments`
direto, sem passar pelo detalhe, le sem deixar linha. Fechar isso e a opcao que
nao foi escolhida (uma linha por rota de leitura), e ela continua disponivel se
o volume se mostrar aceitavel.

A linha carrega `targetType: 'store'`, `targetId`, `requestId` e nenhum
`before`/`after`: nao houve mudanca de estado. `reason` e opcional aqui --
investigar nao e acao com consequencia financeira, e exigir motivo para abrir
uma loja transformaria a exigencia de motivo em ritual que ninguem le.

## D12. Nenhuma rota de operador aceita token de merchant, e vice-versa

Nao e trabalho novo: `@OperatorRoute()`, o `OperatorAuthGuard`, os segredos
separados e a varredura de `operator-routes.spec.ts` ja garantem isso, e os
controllers novos entram no mesmo modulo. O criterio de aceite existe para que
o teste corra sobre as rotas novas, nao para construir nada.

---

# Parte 3 - A tela

Esta parte e `P1` na goal: nenhuma capacidade nova, e ela depende das partes 1
e 2 existirem. Fica aqui porque a decisao de forma e a mesma.

## D13. Sessao de operador nao reusa nada da de merchant

`apps/web` ganha `operator.guard.ts` e um `operator-layout`, ao lado dos de
merchant. Nao ha reuso de `auth.guard.ts`.

A razao e a mesma que fez `Operator` ser tabela propria e nao coluna `role`: a
fronteira da fatia 1 e estrutural no backend, e reusar o guard no frontend a
dissolveria na camada de cima. Um guard com `if (isOperator)` dentro e a mesma
condicional que o PRD pai recusou.

Os cookies ja tem paths proprios (`hockpay_op_at` em `/api/v1/operator`), entao
as duas sessoes **ja coexistem no mesmo browser** -- e um criterio de aceite,
nao um risco a mitigar.

## D14. O que a tela mostra

| Tela               | Conteudo                                                                  |
| ------------------ | ------------------------------------------------------------------------- | --------------- |
| Fila               | `GET /operator/stores?liveStatus=PENDING`, com filtro por estado          |
| Decisao            | Aprovar/rejeitar/suspender, motivo obrigatorio no formulario **e** na API |
| Condicao comercial | Os tres campos editaveis, com o valor atual visivel ao lado do novo       |
| Trilha             | `GET /operator/audit-logs`, com `before`/`after` legiveis, nao JSON cru   |
| Investigacao       | Detalhe da loja, e as leituras de D7 com seletor `TEST                    | LIVE` explicito |

O seletor de ambiente da investigacao e da **mesa**, e nao tem relacao com o
seletor do lojista (PRD proprio): aqui ele e um parametro de consulta, la ele e
uma propriedade da sessao.

## D15. A tela diz o que a mesa nao pode

O PRD pai coloca a lista do que o operador **nao** pode como parte do que o
simulador ensina. A tela de investigacao mostra o webhook config com o `prefix`
e um estado explicito no lugar do secret -- nao um campo vazio. Um campo em
branco parece bug; "nao visivel para operador" e a licao.

---

## Erros

Entra um code:

| Code                       | HTTP | Quando                                                         |
| -------------------------- | ---- | -------------------------------------------------------------- |
| `INVALID_COMMERCIAL_TERMS` | 422  | Valor fora da faixa de D2, negativo, `NaN`, ou dia fracionario |

Categoria `BUSINESS`, como os vizinhos. Reusados sem mudanca:
`OPERATOR_DECISION_REASON_REQUIRED` (motivo ausente),
`STORE_NOT_FOUND` (loja inexistente numa rota de operador),
`PAYMENT_NOT_FOUND`, `ACCOUNT_NOT_FOUND`, `WEBHOOK_CONFIG_NOT_FOUND`.

`environment` ausente ou invalido e `400` de validacao de DTO, nao code de
dominio: e forma de request, nao regra de negocio.

## Migration

**Nenhuma.** Os tres campos de condicao comercial ja existem no schema com
default, e as duas acoes novas de trilha sao valores de uma constante em
TypeScript, nao um enum do Postgres (`OperatorAuditLog.action` e coluna de
texto).

E o que separa esta passagem da fatia 3: la a decisao cara era de modelagem,
aqui e de superficie.

## Nao-objetivos

- **Seletor de ambiente do lojista.** [PRD proprio](PRD_ENVIRONMENT_SELECTOR.md).
- **Antifraude (fatia 6).** O PRD pai coloca o motor depois da fila de revisao.
- **Papeis dentro de `Operator`.** Ajustar taxa e o primeiro poder que alguem
  vai querer separar de "ler dado" -- e continua sendo verdade, e continua nao
  sendo desta passagem.
- **Impersonacao.** Adiada por decisao desde o PRD pai.
- **Escrita de operador sobre dado de loja.** O operador le pagamento; nao
  confirma, nao estorna, nao cancela. "Nao move dinheiro" nao ganha excecao.
- **Notificar o lojista** de mudanca de condicao comercial (D6).
- **Retencao ou purga da trilha.** Ela cresce, e continua crescendo. A escolha
  de D11 mantem o crescimento proporcional a investigacoes, nao a requests, o
  que adia o problema sem resolve-lo.
- **Busca de loja por nome, documento ou pagamento.** A fila filtra por estado.
  Investigar hoje comeca por um id que veio de outro lugar. Vira produto proprio
  quando a fila deixar de caber numa tela.

## Criterios de aceite

**Condicao comercial**

- Mudanca de taxa nao altera `fee` nem `netAmount` de nenhum `Payment` ja
  gravado -- provado por teste que cobra, muda a condicao e rele o pagamento.
- Cobranca criada depois da mudanca usa a condicao nova, no mesmo teste.
- Valor fora da faixa de D2 e recusado pela **entidade**, com
  `INVALID_COMMERCIAL_TERMS` -- provado chamando `updateCommercialTerms` direto.
- Nao existe mudanca de condicao comercial sem linha de trilha correspondente,
  com os tres valores em `before` e em `after` -- provado por teste que conta
  linhas.
- Decisao sem motivo e recusada pelo use case, sem passar pelo controller.

**Leitura**

- Operador le pagamento, ledger, transacao, timeline e entrega de webhook de
  uma loja que nao e dele, escolhendo o ambiente.
- A varredura de D10 falha se uma rota nova devolver secret ou chave -- e o
  teste falha de verdade quando a serializacao e trocada para `toObject()`,
  verificado invertendo-a de proposito uma vez.
- Nao existe rota de operador para API key.
- `GET /operator/stores/:id` grava `store.investigated`; as sub-leituras nao
  gravam nada -- provado por teste que conta linhas antes e depois.
- `environment` ausente e `400`, nao TEST silencioso.
- Token de merchant recebe 401 em toda rota nova, e a varredura de
  `operator-routes.spec.ts` continua verde com os controllers novos.

**Tela**

- Um operador opera a fila inteira, decide, ajusta condicao e le a trilha sem
  `curl`.
- Nenhuma tela de operador expoe secret de webhook ou chave de API.
- Sessao de merchant e de operador coexistem no mesmo browser sem se
  atrapalhar.

**Docs**

- `CURRENT_STATE.md` sai de "o unico poder do operador e habilitar LIVE", e a
  Matriz de Superficies ganha as rotas novas.
- `PRODUCT.md` descreve a jornada de operador.

## Ordem de implementacao

Duas trilhas independentes, e a tela depois das duas. Cada PR deixa a `main`
num estado inteiro.

### PR 1 -- condicao comercial (fatia 4)

1. `Store.updateCommercialTerms` com a faixa de D2, e
   `InvalidCommercialTermsError` com code no catalogo. Ninguem chama ainda.
2. `UpdateCommercialTermsUseCase`, gravando a trilha na mesma transacao, com
   `reason` obrigatorio e `STORE_COMMERCIAL_TERMS_CHANGED` no catalogo de acoes.
3. `POST /operator/stores/:id/commercial-terms`, e os tres campos em
   `GET /stores`.
4. Teste de nao-retroatividade.

### PR 2 -- leitura para investigar (fatia 5)

5. `OperatorStoreReadController` com as seis rotas de D7, reusando os use cases
   e exigindo `environment`.
6. `GET /operator/stores/:id` gravando `store.investigated`.
7. A varredura de D10.

### PR 3 -- a tela

8. `operator.guard.ts` e `operator-layout`, com login e `/operator/me`.
9. Fila e decisao.
10. Condicao comercial, com o antes visivel.
11. Trilha legivel.
12. Investigacao de loja.
13. Docs.

## Riscos

| Risco                                                         | Como aparece                                        | O que segura                                                                      |
| ------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------- |
| Rota de leitura futura vazando secret                         | Credencial exposta, sem erro visivel                | D10: varredura por reflexao, criterio de aceite e nao acabamento                  |
| Caminho de leitura paralelo com nocao propria do que devolver | Um segundo lugar onde o vazamento pode nascer       | D7: os use cases nao mudam, e nao existe use case de leitura de operador          |
| `environment` com default silencioso                          | Investigacao certa sobre o ambiente errado          | D8: obrigatorio, `400` se ausente                                                 |
| Tela de operador reusando a sessao de merchant                | Fronteira da fatia 1 dissolvida na camada de cima   | D13: guard e layout proprios, e o teste de coexistencia das duas sessoes          |
| Taxa fora de faixa por erro de digitacao                      | Toda cobranca futura da loja com taxa absurda       | D2: faixa na entidade, nao no DTO                                                 |
| `settlementDays` menor antecipando `pending` existente        | Liberacao antes do esperado, sem ninguem ter pedido | D3: e o comportamento correto, e a tela diz. Nao e bug, e uma diferenca a ensinar |
| Trilha crescendo com trafego de tela                          | Tabela sem retencao inflando por scroll             | D11: linha por investigacao aberta, nao por request                               |
| Formatar com `pnpm run format` na raiz                        | 413 arquivos de churn que o gate de CI nao pega     | Achado de `2026-09-07`: formatar por pacote                                       |

## O que reabre estas decisoes

- **Mais de um perfil de operador** -> ajustar taxa se separa de ler dado, e
  papeis dentro de `Operator` deixam de ser adivinhacao.
- **Volume de investigacao que uma pessoa nao da conta** -> a fila vira produto
  (SLA, atribuicao, busca), e D11 pode precisar de retencao.
- **Adquirente de verdade** -> a faixa de D2 deixa de ser protecao contra erro
  de digitacao e vira regra comercial, com aprovacao propria.
- **O motor de risco (fatia 6)** -> a fila de revisao ganha um segundo tipo de
  item, e a tela de D14 deixa de ter uma so.
