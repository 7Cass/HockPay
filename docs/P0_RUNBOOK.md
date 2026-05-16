# Hockpay P0 Runbook

Este runbook valida a base demoavel atual: API em `/api/v1`, PostgreSQL, Redis, worker, checkout hospedado e `demo-mediakit`.

Os smokes têm responsabilidades diferentes:

- `pnpm run smoke:p0`: baseline rapido de API direta.
- `pnpm run smoke:payment-link`: validacao de Payment Link/checkout hospedado.
- `pnpm run smoke:p3:visual`: validacao visual do dashboard, timeline, receipts e financeiro.
- `pnpm run smoke:studycase:mediakit`: validacao completa do `demo-mediakit` com API, checkout hospedado, app demo, webhook assinado e estado final renderizavel.
- `pnpm run smoke:docker`: orquestracao local com Postgres/Redis em Docker e servicos Node no host.

O CI atual cobre build, testes unitarios/focados e e2e HTTP mockado da API. Os smokes Docker continuam locais nesta rodada; rodar smokes como gate de CI e trabalho futuro.

## Invariantes P0

- Toda store criada pela API deve ter uma account imediatamente.
- O checkout local usa `http://localhost:3000/api/v1` por default.
- O fluxo completo depende de PostgreSQL e Redis.
- O study case valido para P0 e `apps/demo-mediakit`; para P3 ele funciona como referencia/template/checklist, sem escolher o proximo study-case nesta rodada.

## Subir Infra

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
pnpm run db:generate
pnpm run db:migrate
```

Para uma execucao mais isolada, use o runner local Docker-backed:

```bash
pnpm run smoke:docker
```

Esse comando sobe apenas Postgres e Redis em Docker (`15432` e `16379`), aplica migrations e inicia API, worker e checkout como processos Node no host. Ele valida portas `15432`, `16379`, `3000`, `3001`, `3333`, `3005` e `3999` antes de iniciar.

Opcoes:

```bash
HOCKPAY_SMOKE_SUITE=p0,payment-link,p3,studycase,system pnpm run smoke:docker
HOCKPAY_SMOKE_KEEP_ALIVE=true pnpm run smoke:docker
HOCKPAY_SMOKE_CLEAN_VOLUMES=true pnpm run smoke:docker
HOCKPAY_SMOKE_MIGRATE_MODE=dev pnpm run smoke:docker
```

Um modo "tudo Docker" com API, worker e checkout containerizados ainda exige trabalho futuro para configurar a URL do receiver de webhook acessivel entre containers.

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
# Opcional para uso manual; smoke:studycase:mediakit sobe o demo automaticamente.
pnpm --filter @hockpay/demo-mediakit dev
```

Portas esperadas:

- API: `http://localhost:3000/api/v1`
- Worker: processo separado com BullMQ/Redis
- Checkout: `http://localhost:3333`
- Demo Media Kit: `http://localhost:3005`

## Smoke Automatizado P0

Com PostgreSQL, Redis, API e worker já rodando, execute:

```bash
pnpm run smoke:p0
```

O smoke cria merchant, store, API key TEST, webhook local, payment direto e confirmação simulada. Em seguida, aguarda o worker entregar `payment.confirmed` para um receiver HTTP efêmero em `127.0.0.1` e valida o log persistido em `GET /webhooks/:id/logs`.

Configuração opcional:

```bash
HOCKPAY_API_URL=http://localhost:3000/api/v1 \
HOCKPAY_SMOKE_WEBHOOK_PORT=3999 \
HOCKPAY_SMOKE_TIMEOUT_MS=30000 \
pnpm run smoke:p0
```

Ao concluir, o comando imprime os IDs principais do fluxo. Ele não sobe containers nem processos dev; falhas de conexão indicam que a API, o banco ou o worker ainda não estão prontos.

## Smoke Automatizado de Payment Link

Com PostgreSQL, Redis e API rodando, execute:

```bash
pnpm run smoke:payment-link
```

O smoke cria merchant e store, cria um Payment Link sem expiração, abre o detalhe via `GET /payment-links/:id`, simula uma falha autenticada em `/payment-links/:id/fail`, valida que o link e a PixCharge seguem abertos, simula pagamento em `/payment-links/:id/pay` e valida `PAID`, duas tentativas agrupadas e conversão positiva na listagem.

Fluxo manual equivalente:

```bash
curl -X POST http://localhost:3000/api/v1/payment-links \
  -c /tmp/hockpay.cookies \
  -b /tmp/hockpay.cookies \
  -H "Content-Type: application/json" \
  -d '{"amount":2500,"title":"Cobrança avulsa"}'

curl http://localhost:3000/api/v1/payment-links/PAYMENT_LINK_ID \
  -c /tmp/hockpay.cookies \
  -b /tmp/hockpay.cookies

curl -X POST http://localhost:3000/api/v1/payment-links/PAYMENT_LINK_ID/fail \
  -c /tmp/hockpay.cookies \
  -b /tmp/hockpay.cookies \
  -H "Content-Type: application/json" \
  -d '{"reason":"manual test"}'

curl -X POST http://localhost:3000/api/v1/payment-links/PAYMENT_LINK_ID/pay \
  -c /tmp/hockpay.cookies \
  -b /tmp/hockpay.cookies
```

No dashboard, abra `/dashboard/payment-links/PAYMENT_LINK_ID`. A tela deve mostrar uma única `PixCharge`, as tentativas `Payment` numeradas, falhas sem fechar a cobrança e pagamento confirmado fechando a PixCharge como `PAID`.

## Smoke Visual P3

Com PostgreSQL, Redis, API, worker e web rodando, execute:

```bash
pnpm run smoke:p3:visual
```

O smoke cria dados de dashboard para validar visualmente payments em `PENDING`, `CONFIRMED`, `FAILED`, `EXPIRED`, `REFUNDED` e `RELEASED`. Ele imprime credenciais e links diretos para `/dashboard/payments/:id` e `/dashboard/financials`.

Use esse smoke para conferir que:

- receipt aparece quando esperado para pagamento confirmado.
- timeline mostra eventos principais sem consulta direta ao banco.
- refunds, transactions, webhooks e empty states aparecem de forma coerente por status.
- financeiro mostra saldos pending/available/blocked e extrato read-only.

Esse smoke nao substitui `smoke:p0`: ele e uma validacao visual P3, enquanto `smoke:p0` continua sendo o baseline rapido de API direta e webhook entregue pelo worker.

## Study-case Media Kit

`apps/demo-mediakit` segue como referencia para novos study-cases: checkout hospedado, webhook assinado, simulacao local, account criada automaticamente, receipt e timeline verificaveis.

O proximo study-case nao foi escolhido nesta rodada. O fechamento P3 entrega template/checklist/docs/smokes alinhados para que a escolha futura tenha requisitos minimos claros.

Checklist minimo para escolher um novo study-case:

- objetivo, persona e fluxo de compra escritos antes da implementacao.
- endpoints Hockpay usados e webhook esperado documentados.
- simulacao local com API, checkout hospedado e app do integrador.
- validacao de account, receipt, timeline e financeiro pelo dashboard/API.
- escopo sem Products, Withdrawals, Marketplace, split ou multi-seller enquanto essas areas estiverem em P4.

Com PostgreSQL, Redis, API, worker e checkout rodando, execute:

```bash
pnpm run smoke:studycase:mediakit
```

O smoke cria merchant/store/API key/webhook, sobe o `demo-mediakit` na porta `3005`, cria a checkout session pela rota `/api/create-session` do demo, faz fulfill no checkout hospedado, confirma o payment em TEST e aguarda o webhook assinado liberar o Media Kit na rota `/api/mediakit`.

Configuração opcional:

```bash
HOCKPAY_API_URL=http://localhost:3000/api/v1 \
HOCKPAY_CHECKOUT_URL=http://localhost:3333 \
HOCKPAY_STUDYCASE_DEMO_URL=http://localhost:3005 \
HOCKPAY_STUDYCASE_DEMO_PORT=3005 \
HOCKPAY_SMOKE_TIMEOUT_MS=60000 \
pnpm run smoke:studycase:mediakit
```

Troubleshooting rápido:

- `Could not reach .../health/live`: a API não está rodando na URL configurada.
- `.../health/ready` falha: confira PostgreSQL e migrations.
- Erros de conexão Redis/BullMQ: confira `REDIS_HOST`, `REDIS_PORT` e se o container Redis está rodando.
- Payment cria, mas webhook não chega: confira se o worker está rodando e conectado ao mesmo Redis/PostgreSQL da API.
- `Could not start the local webhook receiver`: a porta configurada já está ocupada.
- `Delivered webhook log was not observed`: confira se o worker e o Redis estão rodando; o dispatcher de outbox precisa consumir o evento.
- `smoke:docker` para em validacao de porta: algum processo local ja usa uma das portas reservadas pelo runner.
- `401 Unauthorized` em `/stores`, `/accounts/me` ou `/api-keys`: esses endpoints usam cookie JWT de dashboard; faça login com `curl -c /tmp/hockpay.cookies -b /tmp/hockpay.cookies`.
- `401 Unauthorized` em `/payments`, `/webhooks` ou `/refunds`: confira `Authorization: Bearer hk_test_xxx` ou `hk_live_xxx`.

## Rastrear Request e Webhook

Toda resposta da API inclui `X-Request-ID`. Você também pode enviar esse header para criar uma trilha conhecida:

```bash
curl -X POST http://localhost:3000/api/v1/payments \
  -H "Authorization: Bearer hk_test_xxx" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: trace-demo-001" \
  -H "X-Request-ID: trace-demo-001" \
  -d '{
    "amount": 1500,
    "customer": {
      "name": "Cliente Trace",
      "email": "trace@hockpay.local",
      "document": "52998224725"
    }
  }'
```

Depois da entrega, consulte os logs do webhook:

```bash
curl "http://localhost:3000/api/v1/webhooks/WEBHOOK_ID/logs?status=delivered" \
  -H "Authorization: Bearer hk_test_xxx"
```

Cada log mostra `requestId`, `outboxEventId`, `deliveryId` e `paymentId`. Esses campos ligam a chamada original, o registro em `outbox_events`, o job do worker e a tentativa de POST no endpoint do integrador. No dashboard, abra Webhooks -> Histórico para ver e copiar os mesmos IDs.

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

Faca login e guarde os cookies de dashboard:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -c /tmp/hockpay.cookies \
  -b /tmp/hockpay.cookies \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@hockpay.local",
    "password": "12345678"
  }'
```

Crie a store:

```bash
curl -X POST http://localhost:3000/api/v1/stores \
  -c /tmp/hockpay.cookies \
  -b /tmp/hockpay.cookies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Media Kit Demo",
    "slug": "media-kit-demo"
  }'
```

Selecione a store criada para renovar o cookie `hockpay_at` com contexto de store:

```bash
curl -X POST http://localhost:3000/api/v1/auth/switch-store/STORE_ID \
  -c /tmp/hockpay.cookies \
  -b /tmp/hockpay.cookies
```

Confirme que a account existe:

```bash
curl http://localhost:3000/api/v1/accounts/me \
  -c /tmp/hockpay.cookies \
  -b /tmp/hockpay.cookies
```

Crie uma API key de teste e guarde o `plainKey`:

```bash
curl -X POST http://localhost:3000/api/v1/api-keys \
  -c /tmp/hockpay.cookies \
  -b /tmp/hockpay.cookies \
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

Para desenvolvimento local, a API aceita webhook HTTP somente em `localhost` ou `127.0.0.1`. Destinos remotos continuam exigindo HTTPS.

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
