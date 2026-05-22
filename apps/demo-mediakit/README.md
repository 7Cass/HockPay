# Media Kit Generator — Demo Hockpay

Demo de integração de um merchant fictício com o Hockpay. No P3 ele também
serve como template de referência para novos study-cases.

## Estado Atual

Esta demo mostra o fluxo real hoje:

1. formulário local cria uma `checkout session`
2. usuário é redirecionado para o checkout hospedado do Hockpay
3. pagamento é concluído ou simulado no checkout
4. Hockpay envia webhook assinado
5. a demo valida a assinatura e libera a página de sucesso

## Contrato de template

O arquivo `study-case.config.ts` concentra o contrato copiável do case:

- produto, preço e copy principal
- campos/metadados enviados para a checkout session
- eventos de webhook aceitos
- estados terminais (`ready`, `failed`, `expired`)
- checklist mínimo de aceite

Para criar outro study-case, mantenha o fluxo base e troque a config,
formulário e renderer específicos do domínio.

## Setup

### 1. Variáveis de ambiente

| Variável | Uso | Default/placeholder local |
| --- | --- | --- |
| `HOCKPAY_API_KEY` | API key TEST usada para criar checkout sessions e, quando necessário, simular pagamentos via contrato autenticado | `hk_test_xxx` |
| `HOCKPAY_BASE_URL` | Base da API Hockpay sem `/api/v1`; o código adiciona `/api/v1` internamente | `http://localhost:3000` |
| `HOCKPAY_WEBHOOK_SECRET` | Secret retornado ao registrar o webhook da demo | `whsec_xxx` |
| `NEXT_PUBLIC_APP_URL` | URL pública da própria demo usada em `successUrl` e `cancelUrl` | `http://localhost:3005` |
| `PORT` | Porta do Next.js quando iniciada pelo runner/smoke | `3005` |

Não configure `HOCKPAY_BASE_URL` com `/api/v1`. Use `http://localhost:3000`, não `http://localhost:3000/api/v1`.

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
| Estados terminais | Trata `payment.confirmed`, `payment.failed` e `payment.expired` |
| Dev mode | Usa fluxo de simulação do checkout |
| Study-case smoke | `pnpm run smoke:studycase:mediakit` |

## Observações

- O storage da demo é in-memory.
- O storage possui uma interface mínima de estados terminais; para produção,
  substitua por persistência real e deduplicação durável de webhooks.
- O checkout Hockpay coleta os dados mínimos do pagador no fluxo hospedado.
- A API base do Hockpay usada pela demo deve apontar para `http://localhost:3000`; as chamadas internas usam `/api/v1`.
