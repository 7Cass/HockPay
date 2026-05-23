# `@hockpay/checkout`

Aplicação Next.js orientada ao comprador final. Ela cobre o checkout hospedado por `checkout session` e o fluxo publico de Payment Link.

## Estado Atual

- Next.js 14
- React 18
- Porta de desenvolvimento: `3333`
- Base URL padrão da API no frontend: `http://localhost:3000/api/v1`
  - o contrato real exposto pela API principal usa `/api/v1`
  - `NEXT_PUBLIC_API_URL` só precisa ser ajustada quando a API estiver em outro host/porta
- Simulação dev habilitada quando `NEXT_PUBLIC_DEV_MODE=true` ou `NODE_ENV=development`

## Fluxo de Checkout Session

1. O merchant cria uma `checkout session` via API.
2. O comprador acessa a rota do checkout com o token.
3. O app busca `GET /api/v1/checkout-sessions/:token`.
4. O comprador envia dados mínimos do customer.
5. O app chama `POST /api/v1/checkout-sessions/:token/fulfill`.
6. Se o checkout estiver em dev mode, a UI pode chamar `POST /api/v1/payments/:id/simulate/:action` com `checkoutToken` no body.
7. Quando a sessão tiver `items`, a UI mostra resumo compacto com nome, descrição, quantidade, preço, subtotal e imagem opcional.

## Fluxo de Payment Link

1. O merchant cria um Payment Link na API/dashboard.
2. O comprador acessa `http://localhost:3333/pay/:token`.
3. O app busca `GET /api/v1/payment-links/public/:token`.
4. Em TEST, a UI pode chamar `POST /api/v1/payment-links/public/:token/pay` ou `/fail`.
5. O backend registra cada tentativa como `Payment` ligada à `PixCharge` do link.
6. Payment Link e sempre cobrança por valor; resumo de itens aparece apenas em checkout sessions itemizadas.

## Contratos Relevantes

- `GET /api/v1/checkout-sessions/:token`
- `POST /api/v1/checkout-sessions/:token/fulfill`
- `POST /api/v1/payments/:id/simulate/:action`
- `GET /api/v1/payment-links/public/:token`
- `POST /api/v1/payment-links/public/:token/pay`
- `POST /api/v1/payment-links/public/:token/fail`

Contrato de simulação usado pela UI dev do checkout:

```bash
curl -X POST http://localhost:3000/api/v1/payments/{payment_id}/simulate/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "checkoutToken": "checkout_token_da_session"
  }'
```

Esse endpoint público aceita `confirm`, `fail` e `expire`. Ele não substitui o contrato autenticado de integração TEST, que fica na API principal em `POST /api/v1/dev/simulate/:id/:action` com API key `hk_test_...` ou cookie JWT.

## Variáveis de Ambiente

| Variável | Uso | Default local |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Base completa da API consumida pelo browser, incluindo `/api/v1` | `http://localhost:3000/api/v1` |
| `NEXT_PUBLIC_DEV_MODE` | Habilita botões de simulação no checkout hospedado quando `true` | `true` em `NODE_ENV=development` |
| `PORT` | Porta usada pelo Next.js quando iniciada pelo runner/smoke | `3333` |

## Observações

- O README antigo dizia que a tela era montada a partir de `GET /payments/:id`; isso não representa o fluxo atual.
- A UI foi desenhada para polling/sincronização de status.
- Payment Link e checkout session sao fluxos separados, ambos simulados.
- Metadata de items de checkout session nao aparece no checkout publico; ela fica restrita a APIs autenticadas e webhooks.

## Documentação Canônica

- [Estado atual](../../docs/CURRENT_STATE.md)
- [Produto](../../docs/PRODUCT.md)
- [Runbook](../../docs/RUNBOOK.md)

## Scripts

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
```

[Voltar ao README raiz](../../README.md)
