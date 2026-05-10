# Media Kit Generator — Demo Hockpay

Demo de integração de um merchant fictício com o Hockpay.

## Estado Atual

Esta demo mostra o fluxo real hoje:

1. formulário local cria uma `checkout session`
2. usuário é redirecionado para o checkout hospedado do Hockpay
3. pagamento é concluído ou simulado no checkout
4. Hockpay envia webhook assinado
5. a demo valida a assinatura e libera a página de sucesso

## Setup

### 1. Variáveis de ambiente

```bash
cp .env.example .env.local
```

Campos relevantes:

- `HOCKPAY_API_KEY`
- `HOCKPAY_BASE_URL`
- `HOCKPAY_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`

## Registrar webhook no Hockpay

```bash
curl -X POST http://localhost:3000/api/v1/webhooks \
  -H "Authorization: Bearer hk_test_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://localhost:3005/api/webhook",
    "events": ["payment.confirmed", "payment.expired", "payment.failed"]
  }'
```

O secret retornado deve ser salvo em:

```env
HOCKPAY_WEBHOOK_SECRET=whsec_xxx
```

## Rodar

```bash
pnpm --filter @hockpay/demo-mediakit dev
```

## O que esta demo cobre

| Feature | Estado atual |
|---------|--------------|
| CheckoutSession | Implementado |
| Metadata | Implementado |
| Redirect flow | Implementado |
| Checkout hospedado | Usa `apps/checkout` |
| Webhook com HMAC | Valida `X-Hockpay-Signature` |
| Dev mode | Usa fluxo de simulação do checkout |

## Observações

- O storage da demo é in-memory.
- O checkout Hockpay coleta os dados mínimos do pagador no fluxo hospedado.
- A API base do Hockpay usada pela demo deve apontar para `http://localhost:3000`; as chamadas internas usam `/api/v1`.
