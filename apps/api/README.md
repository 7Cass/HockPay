# `@hockpay/api`

API REST principal do Hockpay. Esta aplicação expõe os contratos HTTP usados pelo dashboard Angular, pelo checkout e por integrações com API key.

## Estado Atual

- Framework: NestJS 11
- Prefixo HTTP: `/api`
- Versionamento: URI, versão padrão `v1`
- Porta padrão: `3000`
- Autenticação:
  - cookie JWT para dashboard
  - API key `hk_test_...` / `hk_live_...` para integrações públicas

## Módulos Relevantes

| Módulo | Função atual |
|--------|--------------|
| `auth` | login, refresh, logout e troca de store |
| `merchant` | cadastro e leitura de merchant |
| `store` | criação e listagem de stores |
| `api-key` | emissão, listagem e revogação de API keys |
| `customer` | CRUD básico de customers |
| `payment` | criação, listagem, leitura e simulação |
| `webhook` | CRUD, teste, logs e retry |
| `checkout-session` | criação, leitura e fulfill do checkout hospedado |
| `dashboard` | métricas da visão geral |
| `account` / `transaction` | leitura financeira |
| `bank-account` | gestão de contas bancárias |
| `refund` | criação de refunds |
| `receipt` | leitura/gestão de receipts |
| `idempotency` | persistência/cache para endpoints idempotentes |

## Observações Importantes

- Nem toda mutação é idempotente hoje. O fluxo claramente obrigatório é `POST /api/v1/payments`.
- A API usa `CombinedAuthGuard` em vários endpoints públicos para aceitar API key ou cookie JWT.
- O checkout hospedado não consulta `payments/:id` como contrato primário; ele usa `checkout-sessions/:token`.
- A API aceita `X-Request-ID` em qualquer chamada. Se o header não vier, a API gera um ID e sempre devolve `X-Request-ID` na resposta.
- Eventos assíncronos persistem esse request id no outbox e nos logs de webhook; webhooks enviados ao integrador também recebem `X-Request-ID`.

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
      "document": "12345678900"
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
      "document": "52998224725"
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

Destinos HTTP são aceitos apenas em `localhost` ou `127.0.0.1`; webhooks remotos devem usar HTTPS.

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
      "document": "52998224725"
    }
  }'
```

### Login do dashboard

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "merchant@email.com",
    "password": "senha123"
  }'
```

## Variáveis de Ambiente Relevantes

| Variável | Uso |
|----------|-----|
| `PORT` | Porta HTTP da API |
| `DATABASE_URL` | Conexão Prisma/PostgreSQL |
| `REDIS_HOST` / `REDIS_PORT` | Redis para throttling e infra relacionada |
| `JWT_SECRET` | Assinatura de tokens |
| `ENCRYPTION_KEY` | Criptografia de dados sensíveis |
| `PIX_KEY` | Chave Pix simulada usada no payload do pagamento |
| `CORS_ORIGIN` | Lista de origens permitidas |

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
