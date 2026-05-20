# `@hockpay/api`

API REST principal do Hockpay. Esta aplicação expõe os contratos HTTP usados pelo dashboard Angular, pelo checkout e por integrações com API key.

## Estado Atual

- Framework: NestJS 11
- Prefixo HTTP: `/api`
- Versionamento: URI, versão padrão `v1`
- Porta padrão: `3000`
- Base local atual: `http://localhost:3000/api/v1`
- Autenticacao:
  - cookie JWT para dashboard
  - API key `hk_test_...` / `hk_live_...` para integrações públicas
- PostgreSQL é obrigatório para o runtime da API.
- Redis é obrigatório para BullMQ, idempotência/cache operacional e throttling.
- Pagamentos, Pix, Payment Links e saques sao simulados; nao ha adquirencia ou payout real.

## Módulos Relevantes

| Módulo | Função atual |
| --- | --- |
| `auth` | login, refresh, logout e troca de store |
| `merchant` | cadastro e leitura de merchant |
| `store` | criação e listagem de stores |
| `api-key` | emissão, listagem e revogação de API keys |
| `customer` | CRUD básico de customers |
| `customer-history` | histórico de pagamentos e receipts por customer external id |
| `payment` | criação, listagem, leitura, timeline e simulação TEST |
| `payment-link` | criação/listagem/detalhe/cancelamento e fluxo público de link |
| `checkout-session` | criação, leitura e fulfill do checkout hospedado |
| `webhook` | CRUD, teste, logs, retry e inbox dev |
| `alert` | configs, teste, logs e retry de alertas operacionais |
| `dashboard` | métricas da visão geral |
| `account` / `transaction` | leitura financeira e extrato |
| `bank-account` | gestão de contas Pix de saque |
| `withdrawal` | criação/listagem/detalhe, summary, timeline e ações TEST |
| `refund` | criação de refunds |
| `receipt` | leitura/gestão de receipts |
| `idempotency` | persistência/cache para endpoints idempotentes |

## Observações Importantes

- Nem toda mutação é idempotente hoje. Os fluxos obrigatórios são `POST /api/v1/payments` e `POST /api/v1/withdrawals`.
- A API usa `CombinedAuthGuard` em vários endpoints públicos para aceitar API key ou cookie JWT.
- API keys ainda nao possuem scopes granulares; trate `POST /withdrawals` como operacao financeira sensivel.
- O checkout hospedado usa `checkout-sessions/:token` para sessões e `payment-links/public/:token` para links públicos.
- A API aceita `X-Request-ID` em qualquer chamada. Se o header não vier, a API gera um ID e sempre devolve `X-Request-ID` na resposta.
- Eventos assíncronos persistem esse request id no outbox e nos logs de webhook; webhooks enviados ao integrador também recebem `X-Request-ID`.
- A API cria outbox e agenda jobs, mas a entrega efetiva de webhook depende do worker conectado ao mesmo Redis/PostgreSQL.
- `paymentMethod` aceita valores modelados alem de `PIX`, mas o runtime nao possui processador real para cartao, boleto ou debito.

## Exemplos Atuais

### Criar pagamento

```bash
curl -X POST http://localhost:3000/api/v1/payments \
  -H "Authorization: Bearer hk_test_xxx" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: pedido-123" \
  -d '{
    "amount": 1500,
    "customer": {
      "name": "João Silva",
      "email": "joao@email.com",
      "document": "<CPF_DO_CLIENTE>"
    }
  }'
```

### Simular pagamento em dev mode

```bash
curl -X POST http://localhost:3000/api/v1/dev/simulate/{payment_id}/confirm \
  -H "Authorization: Bearer hk_test_xxx"
```

### Criar checkout hosted e fulfill

```bash
curl -X POST http://localhost:3000/api/v1/checkout-sessions \
  -H "Authorization: Bearer hk_test_xxx" \
  -H "Content-Type: application/json" \
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

### Criar saque

```bash
curl -X POST http://localhost:3000/api/v1/withdrawals \
  -H "Authorization: Bearer hk_test_xxx" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: saque-123" \
  -d '{
    "bankAccountId": "bank_account_id",
    "amount": 10000
  }'
```

## Variáveis de Ambiente Relevantes

| Variável                    | Uso                                               |
| --------------------------- | ------------------------------------------------- |
| `PORT`                      | Porta HTTP da API                                 |
| `DATABASE_URL`              | Conexão Prisma/PostgreSQL                         |
| `REDIS_HOST` / `REDIS_PORT` | Redis para BullMQ, throttling e cache operacional |
| `JWT_SECRET`                | Assinatura de tokens                              |
| `ENCRYPTION_KEY`            | Criptografia de dados sensíveis                   |
| `PIX_KEY`                   | Chave Pix simulada usada no payload do pagamento  |
| `CORS_ORIGIN`               | Lista de origens permitidas                       |

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
