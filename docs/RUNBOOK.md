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

## Variáveis de Ambiente por App

Use `.env.example` como base local, sem copiar valores reais de `.env`. API e worker precisam compartilhar `DATABASE_URL`, `ENCRYPTION_KEY` e o mesmo Redis operacional.

### Root compartilhado

| Variável | Uso | Default/placeholder local |
| --- | --- | --- |
| `NODE_ENV` | Seleciona comportamento de dev/test/prod em API, worker e checkout | `development` |
| `DATABASE_URL` | PostgreSQL usado por Prisma, API, worker e migrations | `postgresql://hockpay:hockpay_dev_password@localhost:5432/hockpay?schema=public` |
| `JWT_SECRET` | Assinatura de JWT do dashboard | placeholder forte local |
| `ENCRYPTION_KEY` | Chave hex de 32 bytes para segredos sensíveis | 64 caracteres hex placeholder |
| `REDIS_URL` | Redis da idempotência/cache da API e smoke de concorrência | `redis://localhost:6379` |
| `REDIS_HOST` / `REDIS_PORT` | Redis de BullMQ, throttling, locks e scripts DLQ | `localhost` / `6379` |

`REDIS_URL` e `REDIS_HOST`/`REDIS_PORT` não são substitutos automáticos entre si no código atual. Aponte os dois formatos para a mesma instância quando rodar API, worker e smokes integrados.

`pnpm run db:deploy` no workspace-fonte pode usar o `.env` da raiz. Deploy por artefato que execute `packages/database/dist/prisma.config.ts` deve exportar `DATABASE_URL` no ambiente do processo; não dependa de descoberta de `.env` a partir de `dist`.

### API

| Variável | Uso | Default local |
| --- | --- | --- |
| `PORT` | Porta HTTP da API | `3000` |
| `CORS_ORIGIN` | Origens permitidas separadas por vírgula | origens locais do monorepo |
| `PIX_KEY` | Chave Pix fake em cobranças simuladas | `test@hockpay.com` |
| `CHECKOUT_BASE_URL` | Base pública do checkout para Payment Links e checkout sessions | `http://localhost:3333` |
| `PUBLIC_API_BASE_URL` | Base pública preferencial para URLs absolutas expostas pela API | vazio |
| `APP_URL` | Fallback para URLs absolutas quando `PUBLIC_API_BASE_URL` não existe | vazio |

### Worker

| Variável | Uso | Default local |
| --- | --- | --- |
| `PORT` | Listener Nest do worker | `3001` |
| `REDIS_HOST` / `REDIS_PORT` | BullMQ, locks distribuídos e jobs | `localhost` / `6379` |
| `WORKER_CRON_OUTBOX_DISPATCHER` | Dispatcher de outbox | `*/10 * * * * *` |
| `WORKER_CRON_PAYMENT_EXPIRATION` | Expiração de pagamentos pendentes | `* * * * *` |
| `WORKER_CRON_SETTLEMENT` | Settlement simulado | `0 0 * * *` |
| `WORKER_CRON_WITHDRAWAL_PROCESSING` | Processamento de saques simulados | `*/15 * * * * *` |
| `WORKER_CRON_CLEANUP_LOGS` | Limpeza de logs | `0 3 * * *` |
| `WORKER_CRON_CLEANUP_IDEMPOTENCY_KEYS` | Limpeza de chaves idempotentes | `0 4 * * *` |
| `WORKER_CRON_ANTI_FRAUD` | Varredura antifraude simulada | `0 * * * *` |
| `WORKER_CRON_LOCK_TTL_MS` | TTL do lock distribuído | `300000` |
| `WITHDRAWAL_SIMULATOR_FORCE_FAILURE` | Força falha técnica de saque quando `true` | `false` |

O worker não lê `REDIS_URL`.

### Checkout

| Variável | Uso | Default local |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Base completa da API no browser, incluindo `/api/v1` | `http://localhost:3000/api/v1` |
| `NEXT_PUBLIC_DEV_MODE` | Habilita botões de simulação de pagamento quando `true` | `true` em `NODE_ENV=development` |
| `PORT` | Porta do Next.js | `3333` |

### Demo Media Kit

| Variável | Uso | Default/placeholder local |
| --- | --- | --- |
| `HOCKPAY_API_KEY` | API key TEST usada pela demo | `hk_test_xxx` |
| `HOCKPAY_BASE_URL` | Base da API sem `/api/v1`; a demo adiciona `/api/v1` internamente | `http://localhost:3000` |
| `HOCKPAY_WEBHOOK_SECRET` | Secret do webhook registrado para a demo | `whsec_xxx` |
| `NEXT_PUBLIC_APP_URL` | URL pública da demo para redirects | `http://localhost:3005` |
| `PORT` | Porta do Next.js | `3005` |

### Smokes

| Variável | Uso | Default local |
| --- | --- | --- |
| `HOCKPAY_API_URL` | Base completa da API usada por smokes, incluindo `/api/v1` | `http://localhost:3000/api/v1` |
| `HOCKPAY_CHECKOUT_URL` | Base do checkout nos smokes de Payment Link/studycase/system | `http://localhost:3333` |
| `HOCKPAY_WEB_URL` / `HOCKPAY_DASHBOARD_URL` | Base do dashboard em validações visuais/links | `http://localhost:4200` |
| `HOCKPAY_STUDYCASE_DEMO_URL` | URL da demo Media Kit | `http://localhost:3005` |
| `HOCKPAY_STUDYCASE_DEMO_PORT` | Porta para iniciar a demo no smoke | `3005` |
| `HOCKPAY_STUDYCASE_START_DEMO` | Use `false` para nao iniciar a demo automaticamente | inicia por default |
| `HOCKPAY_SMOKE_WEBHOOK_PORT` | Porta do receiver local de webhook | `3999` |
| `HOCKPAY_SMOKE_TIMEOUT_MS` | Timeout dos smokes focados | varia por smoke |
| `HOCKPAY_SMOKE_DISCORD_WEBHOOK_URL` | Webhook real opcional para smoke de alerta Discord | vazio |
| `HOCKPAY_SMOKE_CUSTOMERS` / `HOCKPAY_SMOKE_PAYMENTS` / `HOCKPAY_SMOKE_PAYMENT_LINKS` / `HOCKPAY_SMOKE_CONCURRENCY` | Volume do smoke `system` | defaults leves |
| `HOCKPAY_SMOKE_IDEMPOTENCY_CONCURRENCY` | Concorrência do smoke de idempotência | `6` |

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
HOCKPAY_SMOKE_SUITE=idempotency,db-concurrency pnpm run smoke:docker
HOCKPAY_SMOKE_API_PORT=3010 pnpm run smoke:docker
HOCKPAY_SMOKE_WORKER_PORT=3011 pnpm run smoke:docker
HOCKPAY_SMOKE_CHECKOUT_PORT=3334 pnpm run smoke:docker
HOCKPAY_SMOKE_STUDYCASE_PORT=3006 pnpm run smoke:docker
HOCKPAY_SMOKE_WEBHOOK_PORT=4000 pnpm run smoke:docker
HOCKPAY_SMOKE_HEALTH_TIMEOUT_MS=120000 pnpm run smoke:docker
HOCKPAY_SMOKE_HTTP_REQUEST_TIMEOUT_MS=10000 pnpm run smoke:docker
HOCKPAY_SMOKE_KEEP_ALIVE=true pnpm run smoke:docker
HOCKPAY_SMOKE_CLEAN_VOLUMES=true pnpm run smoke:docker
HOCKPAY_SMOKE_MIGRATE_MODE=deploy pnpm run smoke:docker
HOCKPAY_SMOKE_MIGRATE_MODE=dev pnpm run smoke:docker
```

Suites suportadas por `HOCKPAY_SMOKE_SUITE`: `p0`, `payment-link`, `p3`, `studycase`, `system`, `withdrawals`, `idempotency` e `db-concurrency`. Quando a suite contem apenas `idempotency` e/ou `db-concurrency`, o runner sobe somente API, Postgres e Redis.

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

O exemplo usa o contrato copiável de integração: `POST /api/v1/payments` com `Idempotency-Key`, `paymentMethod` e `customer.document`.

```bash
curl -X POST http://localhost:3000/api/v1/payments \
  -H "Authorization: Bearer hk_test_xxx" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: pedido-123" \
  -d '{
    "amount": 1500,
    "paymentMethod": "PIX",
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

Esse contrato autenticado aceita `confirm`, `fail`, `expire` e `release` em pagamentos TEST da store. A UI dev do checkout usa outro endpoint público, com `checkoutToken` no body:

```bash
curl -X POST http://localhost:3000/api/v1/payments/PAYMENT_ID/simulate/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "checkoutToken": "checkout_token_da_session"
  }'
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
