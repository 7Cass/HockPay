# Hockpay - Runbook

Runbook operacional para rodar o projeto localmente e validar os fluxos atuais. Para escopo e maturidade, leia `docs/CURRENT_STATE.md`.

## Setup Local

```bash
pnpm install
docker compose -f infrastructure/docker/docker-compose.yml up -d
pnpm run db:generate
pnpm run db:migrate
pnpm run dev
```

Processos principais em desenvolvimento:

```bash
pnpm --filter @hockpay/api dev
pnpm --filter @hockpay/worker dev
pnpm --filter @hockpay/web dev
pnpm --filter @hockpay/checkout dev
pnpm --filter @hockpay/demo-mediakit dev
```

Portas esperadas:

| Processo | URL |
| --- | --- |
| API | `http://localhost:3000/api/v1` |
| Worker | listener Nest em `3001`, jobs via Redis/BullMQ |
| Web dashboard | `http://localhost:4200` |
| Checkout | `http://localhost:3333` |
| Demo Media Kit | `http://localhost:3005` |

## Smoke Docker Local

```bash
pnpm run smoke:docker
```

Esse runner sobe Postgres e Redis em Docker usando `infrastructure/docker/docker-compose.smoke.yml`, aplica migrations e inicia API, worker e checkout como processos Node no host. Ele valida portas `15432`, `16379`, `3000`, `3001`, `3333`, `3005` e `3999`.

Suite default real:

```text
p0,payment-link,p3,studycase,system,withdrawals
```

Opcoes uteis:

```bash
HOCKPAY_SMOKE_SUITE=withdrawals pnpm run smoke:docker
HOCKPAY_SMOKE_SUITE=p0,payment-link pnpm run smoke:docker
HOCKPAY_SMOKE_KEEP_ALIVE=true pnpm run smoke:docker
HOCKPAY_SMOKE_CLEAN_VOLUMES=true pnpm run smoke:docker
HOCKPAY_SMOKE_MIGRATE_MODE=deploy pnpm run smoke:docker
```

## Smokes

| Script | Valida |
| --- | --- |
| `pnpm run smoke:p0` | Merchant/store/API key, pagamento direto, confirmacao TEST e webhook entregue pelo worker. |
| `pnpm run smoke:payment-link` | Criacao de Payment Link, abertura, tentativa falha, tentativa paga e estado da `PixCharge`. |
| `pnpm run smoke:p3:visual` | Dados para dashboard: payments em estados principais, receipt, timeline e financials. |
| `pnpm run smoke:studycase:mediakit` | Demo integrada com checkout hospedado, webhook assinado e estado final renderizavel. |
| `pnpm run smoke:system` | Volume leve cobrindo APIs principais, Payment Links, alerts, bank accounts e withdrawals. |
| `pnpm run smoke:withdrawals` | Fluxo E2E de saques, bank accounts, saldo, ledger, listagem, detalhe e dashboard links. |
| `pnpm run smoke:docker` | Orquestra infra Docker local e smokes sequenciais. |

## Smoke de Withdrawals

Com PostgreSQL, Redis e API rodando:

```bash
pnpm run smoke:withdrawals
```

O smoke cria merchant, store, API key TEST, conta Pix verificada, pagamento de funding, release para saldo disponivel e dois saques. Ele valida:

- `POST /api/v1/withdrawals` com `Idempotency-Key`.
- listagem, filtros, summary e detalhe.
- `POST /api/v1/dev/withdrawals/:id/complete`.
- `POST /api/v1/dev/withdrawals/:id/fail`.
- ledger com `WITHDRAWAL_RESERVED`, `WITHDRAWAL_SENT` e `WITHDRAWAL_REVERSED`.
- protecao contra remocao de bank account com saques vinculados.
- links para `/dashboard/withdrawals`, detalhe do saque e `/dashboard/financials`.

Para evitar que o worker complete saques antes das assertions manuais, o runner Docker-backed usa cron raro para `WORKER_CRON_WITHDRAWAL_PROCESSING`. Em execucoes manuais, use:

```bash
WORKER_CRON_WITHDRAWAL_PROCESSING="0 0 0 1 1 *" pnpm --filter @hockpay/worker dev
```

## Fluxos Manuais Uteis

### Criar pagamento

```bash
curl -X POST http://localhost:3000/api/v1/payments \
  -H "Authorization: Bearer hk_test_xxx" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: pedido-123" \
  -d '{
    "amount": 1500,
    "customer": {
      "name": "Cliente Demo",
      "email": "cliente@hockpay.local",
      "document": "12345678909"
    }
  }'
```

### Confirmar pagamento TEST

```bash
curl -X POST http://localhost:3000/api/v1/dev/simulate/PAYMENT_ID/confirm \
  -H "Authorization: Bearer hk_test_xxx"
```

### Criar Payment Link

```bash
curl -X POST http://localhost:3000/api/v1/payment-links \
  -b /tmp/hockpay.cookies \
  -c /tmp/hockpay.cookies \
  -H "Content-Type: application/json" \
  -d '{"amount":2500,"title":"Cobranca avulsa"}'
```

O checkout publico abre o token em:

```text
http://localhost:3333/pay/PUBLIC_TOKEN
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

## CI

O workflow `.github/workflows/ci.yml` roda:

- build: `pnpm db:generate` e `pnpm build`.
- testes focados: `@hockpay/core test:ci`, `@hockpay/infrastructure test`, `@hockpay/api test`, `@hockpay/worker test`.
- API e2e: `pnpm --filter @hockpay/api test:e2e`.

CI nao roda `pnpm lint` nem smokes locais.

## Troubleshooting

| Sintoma | Verificacao |
| --- | --- |
| `GET /health/live` falha | API fora do ar ou porta errada. |
| `GET /health/ready` falha | Banco indisponivel, migrations pendentes ou `DATABASE_URL` incorreta. |
| Payment cria mas webhook nao chega | Worker fora do ar ou Redis diferente entre API e worker. |
| Jobs nao processam | Conferir `REDIS_HOST`, `REDIS_PORT` e cron envs do worker. |
| `smoke:docker` falha antes de subir | Alguma porta reservada ja esta ocupada. |
| `401` em endpoints de dashboard | Fazer login com cookie jar (`curl -c/-b`) ou usar a sessao do app web. |
| `401` em endpoints de integracao | Conferir API key `hk_test_...`/`hk_live_...` e ambiente. |
| Saque nao pode ser criado | Conferir saldo `available`, bank account verificada, limites e `Idempotency-Key`. |

## Criterios de Aceite Local

- Store criada pela API tem account.
- `smoke:p0` entrega webhook confirmado.
- `smoke:payment-link` valida PixCharge paga apos tentativa final.
- `smoke:withdrawals` valida reserva, envio, reversao e dashboard links.
- Dashboard permite investigar payment, receipt, webhook, financials e withdrawal sem abrir o banco.

