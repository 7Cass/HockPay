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

| Processo       | URL                                            |
| -------------- | ---------------------------------------------- |
| API            | `http://localhost:3000/api/v1`                 |
| Worker         | listener Nest em `3001`, jobs via Redis/BullMQ |
| Web dashboard  | `http://localhost:4200`                        |
| Checkout       | `http://localhost:3333`                        |
| Demo Media Kit | `http://localhost:3005`                        |

## Variáveis de Ambiente por App

Use `.env.example` como base local, sem copiar valores reais de `.env`. API e worker precisam compartilhar `DATABASE_URL`, `ENCRYPTION_KEY` e o mesmo Redis operacional.

### Root compartilhado

| Variável                    | Uso                                                                       | Default/placeholder local                                                        |
| --------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `NODE_ENV`                  | Seleciona comportamento de dev/test/prod em API, worker e checkout        | `development`                                                                    |
| `DATABASE_URL`              | PostgreSQL usado por Prisma, API, worker e migrations                     | `postgresql://hockpay:hockpay_dev_password@localhost:5432/hockpay?schema=public` |
| `JWT_SECRET`                | Assinatura de JWT do dashboard                                            | placeholder forte local                                                          |
| `ENCRYPTION_KEY`            | Chave hex de 32 bytes para segredos sensíveis                             | 64 caracteres hex placeholder                                                    |
| `REDIS_URL`                 | Redis operacional de API, worker, throttling, idempotência/cache e BullMQ | `redis://localhost:6379`                                                         |
| `REDIS_HOST` / `REDIS_PORT` | Forma alternativa para o mesmo Redis operacional                          | `localhost` / `6379`                                                             |
| `THROTTLE_LIMIT`            | Requisicoes por IP em cada janela do rate limit da API                    | `100`                                                                            |
| `THROTTLE_TTL_MS`           | Tamanho da janela do rate limit da API, em ms                             | `60000`                                                                          |
| `THROTTLE_LOGIN_LIMIT`      | Tentativas de `POST /auth/login` por IP na mesma janela                   | `5`                                                                              |

API e worker aceitam `REDIS_URL` somente, `REDIS_HOST`/`REDIS_PORT` somente, ou os dois formatos quando apontam para o mesmo host e porta. Se `REDIS_URL` divergir de `REDIS_HOST`/`REDIS_PORT`, o processo falha no startup com erro de configuracao para evitar API, worker e filas em Redis diferentes.

`pnpm run db:deploy` no workspace-fonte pode usar o `.env` da raiz. Deploy por artefato que execute `packages/database/dist/prisma.config.ts` deve exportar `DATABASE_URL` no ambiente do processo; não dependa de descoberta de `.env` a partir de `dist`.

### API

| Variável              | Uso                                                                  | Default local              |
| --------------------- | -------------------------------------------------------------------- | -------------------------- |
| `PORT`                | Porta HTTP da API                                                    | `3000`                     |
| `CORS_ORIGIN`         | Origens permitidas separadas por vírgula                             | origens locais do monorepo |
| `PIX_KEY`             | Chave Pix fake em cobranças simuladas                                | `test@hockpay.com`         |
| `CHECKOUT_BASE_URL`   | Base pública do checkout para Payment Links e checkout sessions      | `http://localhost:3333`    |
| `PUBLIC_API_BASE_URL` | Base pública preferencial para URLs absolutas expostas pela API      | vazio                      |
| `APP_URL`             | Fallback para URLs absolutas quando `PUBLIC_API_BASE_URL` não existe | vazio                      |

### Worker

| Variável                                   | Uso                                                 | Default local                                    |
| ------------------------------------------ | --------------------------------------------------- | ------------------------------------------------ |
| `PORT`                                     | Listener Nest do worker                             | `3001`                                           |
| `REDIS_URL` ou `REDIS_HOST` / `REDIS_PORT` | BullMQ, locks distribuídos, jobs e health readiness | `redis://localhost:6379` ou `localhost` / `6379` |
| `WORKER_CRON_OUTBOX_DISPATCHER`            | Dispatcher de outbox                                | `*/10 * * * * *`                                 |
| `WORKER_CRON_PAYMENT_EXPIRATION`           | Expiração de pagamentos pendentes                   | `* * * * *`                                      |
| `WORKER_CRON_SETTLEMENT`                   | Settlement simulado                                 | `0 0 * * *`                                      |
| `WORKER_CRON_WITHDRAWAL_PROCESSING`        | Processamento de saques simulados                   | `*/15 * * * * *`                                 |
| `WORKER_CRON_CLEANUP_LOGS`                 | Limpeza de logs                                     | `0 3 * * *`                                      |
| `WORKER_CRON_CLEANUP_IDEMPOTENCY_KEYS`     | Limpeza de chaves idempotentes                      | `0 4 * * *`                                      |
| `WORKER_CRON_ANTI_FRAUD`                   | Varredura antifraude simulada                       | `0 * * * *`                                      |
| `WORKER_CRON_LOCK_TTL_MS`                  | TTL do lock distribuído                             | `300000`                                         |
| `WITHDRAWAL_SIMULATOR_FORCE_FAILURE`       | Força falha técnica de saque quando `true`          | `false`                                          |

Health do worker:

```bash
curl http://localhost:3001/health/live
curl http://localhost:3001/health/ready
```

`/health/live` confirma processo vivo. `/health/ready` consulta PostgreSQL via Prisma e Redis usado por BullMQ; em falha retorna `503` identificando `database` ou `redis`.

### Checkout

| Variável               | Uso                                                     | Default local                    |
| ---------------------- | ------------------------------------------------------- | -------------------------------- |
| `NEXT_PUBLIC_API_URL`  | Base completa da API no browser, incluindo `/api/v1`    | `http://localhost:3000/api/v1`   |
| `NEXT_PUBLIC_DEV_MODE` | Habilita botões de simulação de pagamento quando `true` | `true` em `NODE_ENV=development` |
| `PORT`                 | Porta do Next.js                                        | `3333`                           |

### Demo Media Kit

| Variável                 | Uso                                                               | Default/placeholder local |
| ------------------------ | ----------------------------------------------------------------- | ------------------------- |
| `HOCKPAY_API_KEY`        | API key TEST usada pela demo                                      | `hk_test_xxx`             |
| `HOCKPAY_BASE_URL`       | Base da API sem `/api/v1`; a demo adiciona `/api/v1` internamente | `http://localhost:3000`   |
| `HOCKPAY_WEBHOOK_SECRET` | Secret do webhook registrado para a demo                          | `whsec_xxx`               |
| `NEXT_PUBLIC_APP_URL`    | URL pública da demo para redirects                                | `http://localhost:3005`   |
| `PORT`                   | Porta do Next.js                                                  | `3005`                    |

### Smokes

| Variável                                                                                                           | Uso                                                                                                         | Default local                                                 |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `HOCKPAY_API_URL`                                                                                                  | Base completa da API usada por smokes, incluindo `/api/v1`                                                  | `http://localhost:3000/api/v1`                                |
| `HOCKPAY_CHECKOUT_URL`                                                                                             | Base do checkout nos smokes de Payment Link/studycase/system                                                | `http://localhost:3333`                                       |
| `HOCKPAY_WEB_URL` / `HOCKPAY_DASHBOARD_URL`                                                                        | Base do dashboard em validações visuais/links                                                               | `http://localhost:4200`                                       |
| `HOCKPAY_STUDYCASE_DEMO_URL`                                                                                       | URL da demo Media Kit                                                                                       | `http://localhost:3005`                                       |
| `HOCKPAY_STUDYCASE_DEMO_PORT`                                                                                      | Porta para iniciar a demo no smoke                                                                          | `3005`                                                        |
| `HOCKPAY_STUDYCASE_START_DEMO`                                                                                     | Use `false` para nao iniciar a demo automaticamente                                                         | inicia por default                                            |
| `HOCKPAY_SMOKE_SUITE`                                                                                              | Lista de suites do `smoke:docker`, separada por virgulas                                                    | `p0,payment-link,p3,studycase,system,withdrawals`             |
| `HOCKPAY_SMOKE_API_PORT`                                                                                           | Porta local da API iniciada pelo runner Docker                                                              | `3000`                                                        |
| `HOCKPAY_SMOKE_WORKER_PORT`                                                                                        | Porta local do worker iniciado pelo runner Docker                                                           | `3001`                                                        |
| `HOCKPAY_SMOKE_CHECKOUT_PORT`                                                                                      | Porta local do checkout iniciado pelo runner Docker                                                         | `3333`                                                        |
| `HOCKPAY_SMOKE_STUDYCASE_PORT`                                                                                     | Porta local da demo studycase iniciada pelo runner Docker                                                   | `3005`                                                        |
| `HOCKPAY_SMOKE_WEBHOOK_PORT`                                                                                       | Porta do receiver local de webhook nos smokes `p0`, `p3` e `system`                                         | `3999`                                                        |
| `HOCKPAY_SMOKE_HEALTH_TIMEOUT_MS`                                                                                  | Timeout do runner para Postgres, Redis e health checks HTTP da API/worker                                   | `90000`                                                       |
| `HOCKPAY_SMOKE_HTTP_REQUEST_TIMEOUT_MS`                                                                            | Timeout por tentativa de health check HTTP no runner                                                        | `5000`                                                        |
| `HOCKPAY_SMOKE_ARTIFACT_DIR`                                                                                       | Diretório para diagnosticos quando `smoke:docker` falha                                                     | `artifacts/smoke`                                             |
| `HOCKPAY_SMOKE_TIMEOUT_MS`                                                                                         | Timeout repassado aos scripts filhos; use `180000` para a suite default completa porque ela inclui `system` | `180000` em `.env.example`; fallback interno varia por script |
| `HOCKPAY_SMOKE_POSTGRES_USER`                                                                                      | Usuario do Postgres de smoke Docker                                                                         | `hockpay`                                                     |
| `HOCKPAY_SMOKE_POSTGRES_PASSWORD`                                                                                  | Senha do Postgres de smoke Docker; se ausente, o runner gera uma senha temporaria                           | obrigatório no compose, gerado pelo runner quando ausente     |
| `HOCKPAY_SMOKE_POSTGRES_DB`                                                                                        | Banco do Postgres de smoke Docker                                                                           | `hockpay_smoke`                                               |
| `HOCKPAY_SMOKE_MIGRATE_MODE`                                                                                       | Modo de migration do runner: `deploy` usa `db:deploy`, `dev` usa `db:migrate`                               | `deploy`                                                      |
| `HOCKPAY_SMOKE_CLEAN_VOLUMES`                                                                                      | Use `true` para recriar volumes Docker antes da execucao                                                    | `false`; tambem limpa quando a senha foi gerada               |
| `HOCKPAY_SMOKE_KEEP_ALIVE`                                                                                         | Use `true` para manter processos e containers vivos apos os smokes                                          | `false`                                                       |
| `HOCKPAY_SMOKE_CUSTOMERS` / `HOCKPAY_SMOKE_PAYMENTS` / `HOCKPAY_SMOKE_PAYMENT_LINKS` / `HOCKPAY_SMOKE_CONCURRENCY` | Volume e paralelismo do smoke `system`                                                                      | `50` / `200` / `30` / `8`                                     |
| `HOCKPAY_SMOKE_IDEMPOTENCY_CONCURRENCY`                                                                            | Concorrencia do smoke `idempotency`                                                                         | `6`                                                           |
| `HOCKPAY_SMOKE_REDIS_CONTAINER`                                                                                    | Container Redis que o smoke `idempotency-redis-unavailable` para e reinicia                                 | `hockpay-smoke-redis`                                         |
| `HOCKPAY_SMOKE_DISCORD_WEBHOOK_URL`                                                                                | Webhook real opcional para validar entrega externa de alerta Discord no smoke `system`                      | vazio; sem valor, usa destino fake e nao entrega externamente |

`HOCKPAY_SMOKE_GENERATED_POSTGRES_PASSWORD` e um marcador interno do runner quando ele gera a senha temporaria do Postgres. Nao adicione essa variavel ao `.env.example`.

## Smoke Docker Local

```bash
pnpm run smoke:docker
```

Esse runner sobe Postgres e Redis em Docker usando `infrastructure/docker/docker-compose.smoke.yml`, aplica migrations e inicia API, worker e checkout como processos Node no host. Ele valida portas `15432`, `16379`, `3000`, `3001`, `3333`, `3005` e `3999`.

Antes de executar suites que dependem do worker, o runner aguarda `http://localhost:3001/health/live` e `http://localhost:3001/health/ready`. Suites API-only (`idempotency`, `idempotency-redis-unavailable`, `db-concurrency`) continuam subindo apenas API, Postgres e Redis. Em falha, o runner grava diagnosticos em `artifacts/smoke` por default, incluindo `docker-compose-ps.txt`, logs dos containers de Postgres/Redis e `failure.txt`.

Suite default real:

```text
p0,payment-link,p3,studycase,system,withdrawals
```

Opcoes uteis:

```bash
HOCKPAY_SMOKE_SUITE=withdrawals pnpm run smoke:docker
HOCKPAY_SMOKE_SUITE=p0,payment-link pnpm run smoke:docker
HOCKPAY_SMOKE_SUITE=idempotency,idempotency-redis-unavailable,db-concurrency pnpm run smoke:docker
HOCKPAY_SMOKE_API_PORT=3010 pnpm run smoke:docker
HOCKPAY_SMOKE_WORKER_PORT=3011 pnpm run smoke:docker
HOCKPAY_SMOKE_CHECKOUT_PORT=3334 pnpm run smoke:docker
HOCKPAY_SMOKE_STUDYCASE_PORT=3006 pnpm run smoke:docker
HOCKPAY_SMOKE_WEBHOOK_PORT=4000 pnpm run smoke:docker
HOCKPAY_SMOKE_HEALTH_TIMEOUT_MS=120000 pnpm run smoke:docker
HOCKPAY_SMOKE_HTTP_REQUEST_TIMEOUT_MS=10000 pnpm run smoke:docker
HOCKPAY_SMOKE_TIMEOUT_MS=180000 pnpm run smoke:docker
HOCKPAY_SMOKE_KEEP_ALIVE=true pnpm run smoke:docker
HOCKPAY_SMOKE_CLEAN_VOLUMES=true pnpm run smoke:docker
HOCKPAY_SMOKE_MIGRATE_MODE=deploy pnpm run smoke:docker
HOCKPAY_SMOKE_MIGRATE_MODE=dev pnpm run smoke:docker
```

Suites suportadas por `HOCKPAY_SMOKE_SUITE`: `p0`, `payment-link`, `p3`, `studycase`, `system`, `withdrawals`, `idempotency`, `idempotency-redis-unavailable` e `db-concurrency`. Quando a suite contem apenas `idempotency`, `idempotency-redis-unavailable` e/ou `db-concurrency`, o runner sobe somente API, Postgres e Redis.

## Smokes

| Script                                         | Valida                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `pnpm run smoke:p0`                            | Merchant/store/API key, pagamento direto, confirmacao TEST e webhook entregue pelo worker.  |
| `pnpm run smoke:payment-link`                  | Criacao de Payment Link, abertura, tentativa falha, tentativa paga e estado da `PixCharge`. |
| `pnpm run smoke:p3:visual`                     | Dados para dashboard: payments em estados principais, receipt, timeline e financials.       |
| `pnpm run smoke:studycase:mediakit`            | Demo integrada com checkout hospedado, webhook assinado e estado final renderizavel.        |
| `pnpm run smoke:system`                        | Volume leve cobrindo APIs principais, Payment Links, alerts, bank accounts e withdrawals.   |
| `pnpm run smoke:withdrawals`                   | Fluxo E2E de saques, bank accounts, saldo, ledger, listagem, detalhe e dashboard links.     |
| `pnpm run smoke:idempotency`                   | Concorrencia de idempotency keys com Redis disponivel.                                      |
| `pnpm run smoke:idempotency-redis-unavailable` | Degradacao de idempotencia quando o container Redis fica indisponivel e volta.              |
| `pnpm run smoke:db-concurrency`                | Concorrencia de saldo, ledger e withdrawals apoiada pelo banco.                             |
| `pnpm run smoke:docker`                        | Orquestra infra Docker local e smokes sequenciais.                                          |

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

O runner tambem acelera `WORKER_CRON_OUTBOX_DISPATCHER` para `* * * * * *`. O dispatcher default claim 50 eventos a cada 10 segundos — 300 por minuto — e o smoke `system` gera quase 500 webhooks que ele espera ver entregues em 60 segundos. Sem a aceleracao, a espera acaba antes de o outbox escoar. Ambas as variaveis continuam respeitando o valor do ambiente quando ele ja existe.

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

- build: `lint:check` e `format:check` (API/worker), `pnpm db:generate` e `pnpm build`.
- testes focados: `@hockpay/core test:ci`, `@hockpay/infrastructure test`, `@hockpay/api test`, `@hockpay/worker test`.
- web-test: `@hockpay/web test --watch=false`.
- API e2e: `pnpm --filter @hockpay/api test:e2e`.
- smoke-minimal (`p0,payment-link`) apenas em cron/`workflow_dispatch`.

Settlement do worker processa no maximo 100 payments confirmados por store por ciclo. Expiracao tem fallback dual: fila BullMQ apos create e cron que varre pendentes expirados.

## Troubleshooting

| Sintoma                             | Verificacao                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| `GET /health/live` falha            | API fora do ar ou porta errada.                                                   |
| `GET /health/ready` falha           | Banco indisponivel, migrations pendentes ou `DATABASE_URL` incorreta.             |
| Payment cria mas webhook nao chega  | Worker fora do ar ou Redis diferente entre API e worker.                          |
| Jobs nao processam                  | Conferir `REDIS_HOST`, `REDIS_PORT` e cron envs do worker.                        |
| `smoke:docker` falha antes de subir | Alguma porta reservada ja esta ocupada.                                           |
| `401` em endpoints de dashboard     | Fazer login com cookie jar (`curl -c/-b`) ou usar a sessao do app web.            |
| `401` em endpoints de integracao    | Conferir API key `hk_test_...`/`hk_live_...` e ambiente.                          |
| Saque nao pode ser criado           | Conferir saldo `available`, bank account verificada, limites e `Idempotency-Key`. |

## Criterios de Aceite Local

- Store criada pela API tem account.
- `smoke:p0` entrega webhook confirmado.
- `smoke:payment-link` valida PixCharge paga apos tentativa final.
- `smoke:withdrawals` valida reserva, envio, reversao e dashboard links.
- Dashboard permite investigar payment, receipt, webhook, financials e withdrawal sem abrir o banco.
