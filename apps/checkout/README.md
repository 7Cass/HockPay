# `@hockpay/checkout`

Aplicação Next.js orientada ao comprador final. O checkout hospedado atual é baseado em token de `checkout session`, não em leitura direta de `payment` como contrato primário.

## Estado Atual

- Next.js 14
- React 18
- Porta de desenvolvimento: `3333`
- Base URL padrão da API no frontend: `http://localhost:3000/api/v1`
  - o contrato real exposto pela API principal usa `/api/v1`
  - `NEXT_PUBLIC_API_URL` só precisa ser ajustada quando a API estiver em outro host/porta

## Fluxo Atual

1. O merchant cria uma `checkout session` via API.
2. O comprador acessa a rota do checkout com o token.
3. O app busca `GET /api/v1/checkout-sessions/:token`.
4. O comprador envia dados mínimos do customer.
5. O app chama `POST /api/v1/checkout-sessions/:token/fulfill`.
6. Se o checkout estiver em dev mode, a UI pode chamar `POST /api/v1/payments/:id/simulate/:action`.

## Contratos Relevantes

- `GET /api/v1/checkout-sessions/:token`
- `POST /api/v1/checkout-sessions/:token/fulfill`
- `POST /api/v1/payments/:id/simulate/:action`

## Observações

- O README antigo dizia que a tela era montada a partir de `GET /payments/:id`; isso não representa o fluxo atual.
- A UI foi desenhada para polling/sincronização de status, mas o contrato central é a checkout session.

## Scripts

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
```

[Voltar ao README raiz](../../README.md)
