# Media Kit Generator — Demo HockPay

Demo de integração de merchant fictício com a plataforma HockPay.

## Fluxo

1. Preencha o formulário com dados do seu Media Kit
2. Clique em "Gerar Media Kit" — cria uma CheckoutSession no HockPay
3. Você é redirecionado ao checkout hospedado do HockPay
4. Pague via Pix (ou use o botão de simulação em dev mode)
5. O HockPay envia um webhook confirmando o pagamento
6. O Media Kit é gerado e exibido na página de sucesso

## Setup

### 1. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Edite `.env.local` com seus valores:

- `HOCKPAY_API_KEY`: Sua API key de teste (`hk_test_...`)
- `HOCKPAY_BASE_URL`: URL da API HockPay (padrão: `http://localhost:3000`)
- `HOCKPAY_WEBHOOK_SECRET`: Secret do webhook (obtido ao criar o webhook)
- `NEXT_PUBLIC_APP_URL`: URL da demo (padrão: `http://localhost:3005`)

### 2. Registrar o Webhook no HockPay

Antes de rodar, crie um webhook configurado para receber eventos de pagamento:

```bash
curl -X POST http://localhost:3000/v1/webhooks \
  -H "Authorization: Bearer hk_test_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://localhost:3005/api/webhook",
    "events": ["payment.confirmed", "payment.expired", "payment.failed"]
  }'
```

Copie o `secret` retornado (aparece apenas uma vez!) e coloque no `.env.local`:

```env
HOCKPAY_WEBHOOK_SECRET=whsec_xxx
```

### 3. Rodar

```bash
pnpm --filter @hockpay/demo-mediakit dev
```

Acesse `http://localhost:3005`

## O que esta demo demonstra

| Feature HockPay      | Como é usada                                     |
| -------------------- | ------------------------------------------------ |
| CheckoutSession      | Cria sessão de pagamento com metadata            |
| Metadata             | Dados do Media Kit via `metadata` na sessão      |
| Redirect Flow        | `successUrl` + `cancelUrl` configurados          |
| Checkout Hospedado   | Usa `apps/checkout` existente                    |
| Webhook com HMAC     | Valida assinatura `X-Hockpay-Signature`          |
| Metadata-driven Flow | Webhook extrai metadata para gerar o produto     |
| Dev Mode             | Botão de simulação no checkout para teste rápido |

## Arquitetura

```
Formulário → POST /api/create-session → HockPay CheckoutSession
  → Redirect → apps/checkout (HockPay)
  → Pagamento Pix → Webhook → POST /api/webhook
  → Valida HMAC → Salva dados → Success Page (polling)
  → GET /api/mediakit → Renderiza Media Kit
```

## Notas

- **Storage in-memory**: Os dados do Media Kit são armazenados em memória (`Map`). Adequado para demo, mas em produção usaria banco de dados.
- **Nome do criador**: O `creatorName` é enviado no metadata da CheckoutSession. O checkout HockPay coleta CPF separadamente (contexto de pagamento).
