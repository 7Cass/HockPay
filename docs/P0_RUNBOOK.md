# Hockpay P0 Runbook

Este runbook valida a base demoavel atual: API em `/api/v1`, PostgreSQL, Redis, worker, checkout hospedado e `demo-mediakit`.

## Invariantes P0

- Toda store criada pela API deve ter uma account imediatamente.
- O checkout local usa `http://localhost:3000/api/v1` por default.
- O fluxo completo depende de PostgreSQL e Redis.
- O study case valido para P0 e `apps/demo-mediakit`.

## Subir Infra

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
pnpm run db:generate
pnpm run db:migrate
```

Verifique a invariante de account depois das migrations:

```sql
SELECT COUNT(*) AS stores_without_account
FROM stores s
LEFT JOIN accounts a ON a.store_id = s.id
WHERE a.id IS NULL;
```

Resultado esperado: `0`.

## Processos Locais

Rode cada processo em um terminal separado:

```bash
pnpm --filter @hockpay/api dev
pnpm --filter @hockpay/worker dev
pnpm --filter @hockpay/checkout dev
pnpm --filter @hockpay/demo-mediakit dev
```

Portas esperadas:

- API: `http://localhost:3000/api/v1`
- Worker: processo separado com BullMQ/Redis
- Checkout: `http://localhost:3333`
- Demo Media Kit: `http://localhost:3005`

## Preparar Merchant, Store e API Key

Crie um merchant:

```bash
curl -X POST http://localhost:3000/api/v1/merchants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Demo Merchant",
    "email": "demo@hockpay.local",
    "password": "12345678",
    "document": "52998224725"
  }'
```

Faca login e guarde o `accessToken`:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@hockpay.local",
    "password": "12345678"
  }'
```

Crie a store:

```bash
curl -X POST http://localhost:3000/api/v1/stores \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Media Kit Demo",
    "slug": "media-kit-demo"
  }'
```

Confirme que a account existe:

```bash
curl http://localhost:3000/api/v1/accounts/me \
  -H "Authorization: Bearer STORE_ACCESS_TOKEN"
```

Crie uma API key de teste e guarde o `plainKey`:

```bash
curl -X POST http://localhost:3000/api/v1/api-keys \
  -H "Authorization: Bearer STORE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Demo Media Kit",
    "environment": "TEST"
  }'
```

## Registrar Webhook da Demo

Configure a demo com a API key:

```env
HOCKPAY_API_KEY=hk_test_xxx
HOCKPAY_BASE_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3005
```

Registre o webhook:

```bash
curl -X POST http://localhost:3000/api/v1/webhooks \
  -H "Authorization: Bearer hk_test_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://localhost:3005/api/webhook",
    "events": ["payment.confirmed", "payment.expired", "payment.failed"]
  }'
```

Copie o `secret` retornado para a demo:

```env
HOCKPAY_WEBHOOK_SECRET=whsec_xxx
```

Reinicie `apps/demo-mediakit` se alterar `.env.local`.

## Executar Fluxo de Checkout

1. Abra `http://localhost:3005`.
2. Preencha o formulario do media kit.
3. A demo deve criar uma checkout session e redirecionar para `http://localhost:3333/{token}`.
4. Complete os dados do pagador no checkout.
5. Use a acao de simulacao do checkout em dev mode ou chame a API:

```bash
curl -X POST http://localhost:3000/api/v1/dev/simulate/PAYMENT_ID/confirm \
  -H "Authorization: Bearer hk_test_xxx"
```

## Validacoes Esperadas

- `GET /api/v1/payments/{payment_id}` retorna `status: "CONFIRMED"`.
- `GET /api/v1/accounts/me` mostra `pending` aumentado pelo valor liquido do pagamento.
- `GET /api/v1/receipts` inclui o recibo do pagamento confirmado.
- `GET /api/v1/webhooks/{webhook_id}/logs` mostra entrega para `http://localhost:3005/api/webhook`.
- O worker registra processamento de outbox e entrega na fila `webhook-delivery`.
- A demo valida `X-Hockpay-Signature` e libera a pagina de sucesso.

## Checks Automatizados P0

```bash
pnpm --filter @hockpay/core test -- --run
pnpm --filter @hockpay/infrastructure test
pnpm --filter @hockpay/api test
pnpm run build
```

## Known Non-P0

- Products e PaymentItems nao fazem parte da validacao P0.
- Withdrawals ficam fora desta etapa.
- Marketplace, split de pagamento e multi-seller ficam fora desta etapa.
