# `@hockpay/api`

API REST principal do Hockpay. Esta aplicação expõe os contratos HTTP usados pelo dashboard Angular, pelo checkout e por integrações com API key.

## Estado Atual

- Framework: NestJS 11
- Prefixo HTTP: `/api`
- Versionamento: URI, versão padrão `v1`
- Porta padrão: `3000`
- Base local atual: `http://localhost:3000/api/v1`
- Autenticacao:
  - cookie JWT para dashboard (audiência `merchant`)
  - API key `hk_test_...` / `hk_live_...` para integrações públicas
  - cookie e segredo próprios para o operador (audiência `operator`), em `/api/v1/operator`
- PostgreSQL é obrigatório para o runtime da API.
- Redis é obrigatório para BullMQ, idempotência/cache operacional e throttling.
- Pagamentos, Pix, Payment Links e saques sao simulados; nao ha adquirencia ou payout real.

## Módulos Relevantes

| Módulo                    | Função atual                                                  |
| ------------------------- | ------------------------------------------------------------- |
| `auth`                    | login, refresh, logout e troca de store                       |
| `merchant`                | cadastro e leitura de merchant                                |
| `store`                   | criação e listagem de stores                                  |
| `api-key`                 | emissão, listagem e revogação de API keys                     |
| `customer`                | CRUD básico de customers                                      |
| `customer-history`        | histórico de pagamentos e receipts por customer external id   |
| `product`                 | CRUD de catálogo store-scoped usado por checkout sessions     |
| `payment`                 | criação, listagem, leitura, timeline e simulação TEST         |
| `payment-link`            | criação/listagem/detalhe/cancelamento e fluxo público de link |
| `checkout-session`        | criação, leitura e fulfill do checkout hospedado              |
| `webhook`                 | CRUD, teste, logs, retry e inbox dev                          |
| `alert`                   | configs, teste, logs e retry de alertas operacionais          |
| `dashboard`               | métricas da visão geral                                       |
| `account` / `transaction` | leitura financeira e extrato                                  |
| `bank-account`            | gestão de contas Pix de saque                                 |
| `withdrawal`              | criação/listagem/detalhe, summary, timeline e ações TEST      |
| `refund`                  | criação de refunds                                            |
| `receipt`                 | leitura/gestão de receipts                                    |
| `idempotency`             | persistência/cache para endpoints idempotentes                |

## Observações Importantes

- Mutações com `Idempotency-Key` obrigatória: `POST /api/v1/payments`, `POST /api/v1/withdrawals`, `POST /api/v1/refunds`, `POST /api/v1/payment-links` e `POST /api/v1/checkout-sessions`. A chave é isolada por store e environment (TEST/LIVE).
- A API usa `CombinedAuthGuard` em vários endpoints públicos para aceitar API key ou cookie JWT.
- `POST /withdrawals`, `POST /refunds` e mutações de `bank-accounts` exigem sessão JWT do dashboard. API key recebe 403. Key TEST ainda pode simular (`/dev/simulate`, pay autenticado de Payment Link, `/dev/withdrawals/:id/complete|fail`) no saldo compartilhado da store; key LIVE não.
- O checkout hospedado usa `checkout-sessions/:token` para sessões e `payment-links/public/:token` para links públicos.
- A API aceita `X-Request-ID` em qualquer chamada. Se o header não vier, a API gera um ID e sempre devolve `X-Request-ID` na resposta.
- Eventos assíncronos persistem esse request id no outbox e nos logs de webhook; webhooks enviados ao integrador também recebem `X-Request-ID`.
- A API cria outbox e agenda jobs, mas a entrega efetiva de webhook depende do worker conectado ao mesmo Redis/PostgreSQL.
- Escrita de cobranca e so `PIX`. O schema ainda modela cartao, boleto e debito como legado; `POST /payments` rejeita qualquer outro metodo.
- Products sao opcionais e separados por store/environment; hoje alimentam checkout sessions com `items`. `POST /api/v1/payments` segue como API direta de baixo nivel, sem `items`.
- Payment Links aceitam exatamente um de `amount` ou `items`, como as checkout sessions.
- Checkout sessions aceitam exatamente um de `amount` ou `items`; `items` referencia produtos existentes por `productId` e o total e derivado de `quantity * product.price`.
- O operador é um principal separado: token de merchant recebe 401 em `/api/v1/operator`, token de operador recebe 401 em qualquer rota de merchant, e API key não autentica operador em nenhum environment. Não há elevação de merchant para operador, e não existe cadastro público de operador — só `pnpm operator:create`.
- Nesta fatia o operador não tem poder sobre loja nenhuma: as rotas existentes são sessão, `/operator/me` e a leitura da trilha de auditoria.

## Exemplos Atuais

### Criar pagamento

Todo `POST /api/v1/payments` copiável deve enviar `Idempotency-Key`, `paymentMethod` e `customer.document`.

```bash
curl -X POST http://localhost:3000/api/v1/payments \
  -H "Authorization: Bearer hk_test_xxx" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: pedido-123" \
  -d '{
    "amount": 1500,
    "paymentMethod": "PIX",
    "customer": {
      "name": "João Silva",
      "email": "joao@email.com",
      "document": "<CPF_DO_CLIENTE>"
    }
  }'
```

### Simular pagamento em dev mode

Fluxo autenticado para integradores TEST. Requer API key `hk_test_...` ou cookie JWT da store dona do pagamento:

```bash
curl -X POST http://localhost:3000/api/v1/dev/simulate/{payment_id}/confirm \
  -H "Authorization: Bearer hk_test_xxx"
```

Ações suportadas: `confirm`, `fail`, `expire` e `release`.

O checkout hospedado usa outro contrato público, restrito ao token da sessão. Ele existe para a UI dev do comprador e recebe o token no body:

```bash
curl -X POST http://localhost:3000/api/v1/payments/{payment_id}/simulate/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "checkoutToken": "checkout_token_retornado_pela_session"
  }'
```

Nesse fluxo público as ações suportadas são `confirm`, `fail` e `expire`.

### Criar checkout hosted e fulfill

```bash
curl -X POST http://localhost:3000/api/v1/checkout-sessions \
  -H "Authorization: Bearer hk_test_xxx" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: checkout-pedido-123" \
  -d '{
    "amount": 2500,
    "description": "Media kit premium",
    "successUrl": "http://localhost:3005/success",
    "cancelUrl": "http://localhost:3005/"
  }'
```

Use o `checkoutToken` retornado para preencher o pagador:

```bash
curl -X POST http://localhost:3000/api/v1/checkout-sessions/{checkout_token}/fulfill \
  -H "Content-Type: application/json" \
  -d '{
    "customer": {
      "name": "João Silva",
      "email": "joao@email.com",
      "document": "<CPF_DO_CLIENTE>"
    }
  }'
```

### Criar produto e usar em checkout session

```bash
curl -X POST http://localhost:3000/api/v1/products \
  -H "Authorization: Bearer hk_test_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "externalId": "media-kit-premium",
    "name": "Media kit premium",
    "description": "Pacote premium para criadores",
    "price": 2500,
    "imageUrl": "https://example.com/media-kit.png",
    "metadata": {
      "category": "demo"
    }
  }'
```

Produtos arquivados retornam `isActive=false` e não podem ser usados em novas checkout sessions.
`externalId` é único por `storeId + environment`. Metadata do produto não é copiada automaticamente para os items; use `items[].metadata` quando precisar de contexto por cobrança.

Checkout session com item de produto:

```bash
curl -X POST http://localhost:3000/api/v1/checkout-sessions \
  -H "Authorization: Bearer hk_test_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Pedido com catálogo",
    "items": [
      {
        "productId": "product_id",
        "quantity": 2,
        "metadata": { "line": "catalog" }
      }
    ],
    "successUrl": "http://localhost:3005/success",
    "cancelUrl": "http://localhost:3005/"
  }'
```

`items` aceita apenas `{ "productId": "...", "quantity": 1, "metadata": { ... } }`. Produtos inexistentes, inativos ou de outro environment/store rejeitam a criação. APIs autenticadas e webhooks retornam snapshots completos, incluindo metadata do item; endpoints públicos do checkout não expõem metadata.

Payment Link continua sendo cobrança avulsa por valor:

```bash
curl -X POST http://localhost:3000/api/v1/payment-links \
  -H "Authorization: Bearer hk_test_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 2500,
    "title": "Compra avulsa"
  }'
```

### Registrar webhook e consultar logs

```bash
curl -X POST http://localhost:3000/api/v1/webhooks \
  -H "Authorization: Bearer hk_test_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://localhost:3999/webhook",
    "events": ["payment.confirmed", "payment.expired", "payment.failed"]
  }'
```

Eventos permitidos hoje:

```text
payment.created
payment.confirmed
payment.failed
payment.expired
payment.released
payment.refunded
withdrawal.created
withdrawal.processing
withdrawal.completed
withdrawal.failed
```

Destinos HTTP são aceitos apenas em `localhost` ou `127.0.0.1` quando a API/worker rodam em ambiente local ou de desenvolvimento. Webhooks remotos devem usar HTTPS público; alvos de loopback remoto, RFC1918, link-local, metadata `169.254.169.254`, IPv6 local/link-local/unique-local e protocolos não HTTP(S) são bloqueados na criação/edição e antes do envio.

```bash
curl "http://localhost:3000/api/v1/webhooks/{webhook_id}/logs?page=1&limit=20&status=delivered" \
  -H "Authorization: Bearer hk_test_xxx"
```

Cada item retornado em `logs` inclui `requestId`, `outboxEventId`, `deliveryId` e `paymentId` quando disponíveis. Use esses IDs para cruzar a chamada HTTP original, o evento outbox, o job do worker e a tentativa de entrega.

Exemplo para iniciar uma trilha com ID próprio:

```bash
curl -X POST http://localhost:3000/api/v1/payments \
  -H "Authorization: Bearer hk_test_xxx" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: pedido-123" \
  -H "X-Request-ID: demo-trace-001" \
  -d '{
    "amount": 1500,
    "paymentMethod": "PIX",
    "customer": {
      "name": "João Silva",
      "email": "joao@email.com",
      "document": "<CPF_DO_CLIENTE>"
    }
  }'
```

### Login do dashboard

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "merchant@email.com",
    "password": "<SENHA_FORTE_LOCAL>"
  }'
```

### Sessão de operador

```bash
# Provisionamento (fora da API, sem cadastro público)
printf 'senha-local-forte\n' | pnpm operator:create --email desk@hockpay.local --name "Mesa"

# Login: os cookies do operador vivem em /api/v1/operator
curl -X POST http://localhost:3000/api/v1/operator/auth/login \
  -H "Content-Type: application/json" \
  -c operator-cookies.txt \
  -d '{"email":"desk@hockpay.local","password":"senha-local-forte"}'

curl http://localhost:3000/api/v1/operator/me -b operator-cookies.txt

# Trilha de auditoria, mais recente primeiro
curl "http://localhost:3000/api/v1/operator/audit-logs?limit=20" -b operator-cookies.txt
```

O cookie de dashboard (`hockpay_at`) recebe 401 nessas rotas, e o cookie de operador (`hockpay_op_at`) recebe 401 nas rotas de merchant.

### Criar saque

```bash
curl -X POST http://localhost:3000/api/v1/withdrawals \
  -H "Cookie: hockpay_at=<jwt_do_dashboard>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: saque-123" \
  -d '{
    "bankAccountId": "bank_account_id",
    "amount": 10000
  }'
```

API key neste endpoint responde 403. Use a sessão do dashboard.

### Criar refund

```bash
curl -X POST http://localhost:3000/api/v1/refunds \
  -H "Cookie: hockpay_at=<jwt_do_dashboard>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: refund-pedido-123" \
  -d '{
    "paymentId": "payment_id_confirmado",
    "amount": 500,
    "reason": "Ajuste solicitado pelo cliente"
  }'
```

API key neste endpoint responde 403. Use a sessão do dashboard.

Payments, withdrawals e refunds retornam `x-idempotency-key` e um indicador booleano de replay. Repita a mesma chave apenas para o mesmo metodo, path e body.

## Variáveis de Ambiente Relevantes

| Variável                    | Uso                                                              | Default local              |
| --------------------------- | ---------------------------------------------------------------- | -------------------------- |
| `PORT`                      | Porta HTTP da API                                                | `3000`                     |
| `DATABASE_URL`              | Conexão Prisma/PostgreSQL                                        | obrigatório                |
| `REDIS_URL`                 | Redis usado pelo cache de idempotência da API                    | `redis://localhost:6379`   |
| `REDIS_HOST` / `REDIS_PORT` | Redis para BullMQ, throttling e filas de expiração               | `localhost` / `6379`       |
| `JWT_SECRET`                | Assinatura de tokens do dashboard                                | obrigatório                |
| `OPERATOR_JWT_SECRET`       | Assinatura de tokens do operador; sem fallback para `JWT_SECRET` | obrigatório                |
| `ENCRYPTION_KEY`            | Criptografia de segredos sensíveis; precisa ter 64 chars hex     | obrigatório                |
| `PIX_KEY`                   | Chave Pix simulada usada no payload do pagamento                 | `test@hockpay.com`         |
| `CHECKOUT_BASE_URL`         | Base pública do checkout usada em links e checkout sessions      | `http://localhost:3333`    |
| `PUBLIC_API_BASE_URL`       | Base pública preferencial para URLs absolutas expostas pela API  | vazio                      |
| `APP_URL`                   | Fallback de base pública quando `PUBLIC_API_BASE_URL` não existe | vazio                      |
| `CORS_ORIGIN`               | Lista de origens permitidas separada por vírgula                 | origens locais do monorepo |

`REDIS_URL` e `REDIS_HOST`/`REDIS_PORT` precisam apontar para o mesmo Redis quando API e worker rodam juntos; o primeiro atende idempotência/cache, os demais atendem BullMQ, throttling e jobs.

Para migrations, `pnpm run db:deploy` no workspace-fonte pode usar o `.env` da raiz. Se o deploy executar o artefato `packages/database/dist/prisma.config.ts`, exporte `DATABASE_URL` no ambiente do processo; não conte com descoberta de `.env` dentro de `dist`.

## Documentação Canônica

- [Estado atual](../../docs/CURRENT_STATE.md)
- [Modelo de dados](../../docs/DATA_MODEL.md)
- [Runbook](../../docs/RUNBOOK.md)

## Troubleshooting

| Sintoma                                 | Causa provável                             | Ação                                                                          |
| --------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| `GET /health/live` falha                | API fora do ar ou porta errada             | conferir `PORT` e processo `@hockpay/api`                                     |
| `GET /health/ready` falha               | banco indisponível ou migrations pendentes | subir PostgreSQL e rodar `pnpm run db:deploy` ou `pnpm run db:migrate` em dev |
| Payment confirmado sem webhook entregue | worker ou Redis indisponível               | subir `@hockpay/worker` e conferir `REDIS_HOST`/`REDIS_PORT`                  |
| `401` em endpoints dashboard-only       | cookie JWT ausente/expirado                | fazer login usando cookie jar (`curl -c/-b`)                                  |
| `401` em endpoints de integração        | API key ausente/revogada/ambiente errado   | usar `Authorization: Bearer hk_test_...` ou `hk_live_...`                     |

## Scripts

```bash
pnpm dev
pnpm build
pnpm test
pnpm test:e2e
pnpm run smoke:p0
pnpm start:prod
```

[Voltar ao README raiz](../../README.md)
