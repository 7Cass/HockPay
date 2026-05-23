# `@hockpay/web`

Aplicação Angular principal do Hockpay. Ela reúne landing page, autenticação e dashboard do merchant em um único app.

## Estado Atual

- Angular 21
- `provideZonelessChangeDetection`
- Tailwind CSS v4
- Spartan UI / libs locais em `libs/`
- Porta padrão de desenvolvimento: `4200`

## Áreas do App

| Rota | Caminho | Estado atual |
| --- | --- | --- |
| `/` | `features/landing` | Implementada |
| `/login`, `/register` | `features/auth` | Implementada |
| `/dashboard` | `features/dashboard/pages/overview` | Implementada, com cards de pagamentos, financeiro e saques |
| `/dashboard/payments` | `features/dashboard/pages/payments` | Implementada |
| `/dashboard/payments/:id` | `features/dashboard/pages/payment-detail` | Implementada com timeline operacional |
| `/dashboard/payment-links` | `features/dashboard/pages/payment-links` | Implementada |
| `/dashboard/payment-links/:id` | `features/dashboard/pages/payment-link-detail` | Implementada |
| `/dashboard/receipts` | `features/dashboard/pages/receipts` | Implementada |
| `/dashboard/receipts/:id` | `features/dashboard/pages/receipt-detail` | Implementada |
| `/dashboard/customers` | `features/dashboard/pages/customers` | Implementada |
| `/dashboard/customers/:id` | `features/dashboard/pages/customer-detail` | Implementada |
| `/dashboard/api` | `features/dashboard/pages/api` | Implementada para API keys |
| `/dashboard/webhooks` | `features/dashboard/pages/webhooks` | Implementada |
| `/dashboard/alerts` | `features/dashboard/pages/alerts` | Implementada |
| `/dashboard/financials` | `features/dashboard/pages/financials` | Implementada como leitura de saldos e extrato |
| `/dashboard/withdrawals` | `features/dashboard/pages/withdrawals` | Implementada com listagem, summary, filtros, criação e bank accounts |
| `/dashboard/withdrawals/:id` | `features/dashboard/pages/withdrawal-detail` | Implementada com timeline, transactions e ações TEST |
| `/dashboard/products` | `features/dashboard/pages/products` | Implementada para CRUD de catálogo TEST/LIVE da store |
| `/dashboard/settings` | `features/dashboard/pages/settings` | Parcial/read-only |

## Padrões Atuais

- Roteamento por `loadComponent`
- Injeção funcional e serviços Angular para comunicação com a API
- Uso de Signals em partes relevantes do estado
- Uso de RxJS ainda presente nos serviços de HTTP e autenticação

## Observações

- Não existem `apps/dashboard` e `apps/landing` separados no repositório atual.
- O app assume integração com a API principal em `http://localhost:3000/api/v1` por meio dos serviços Angular.
- Payment Links, Products, Financials e Withdrawals sao areas reais do dashboard atual.
- Products e uma area CRUD real; checkout sessions com items permanecem API-first no MVP.
- Settings nao deve ser tratado como painel completo de configuracao mutavel.

## Documentação Canônica

- [Estado atual](../../docs/CURRENT_STATE.md)
- [Produto](../../docs/PRODUCT.md)
- [Runbook](../../docs/RUNBOOK.md)

## Scripts

```bash
pnpm dev
pnpm build
pnpm test
```

[Voltar ao README raiz](../../README.md)
