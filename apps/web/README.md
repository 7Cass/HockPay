# `@hockpay/web`

Aplicação Angular principal do Hockpay. No estado atual, ela reúne landing page, autenticação e dashboard em um único app.

## Estado Atual

- Angular 21
- `provideZonelessChangeDetection`
- Tailwind CSS v4
- Spartan UI / libs locais em `libs/`
- Porta padrão de desenvolvimento: `4200`

## Áreas do App

| Área | Caminho | Estado atual |
|------|---------|--------------|
| Landing | `src/app/features/landing` | Implementada |
| Auth | `src/app/features/auth` | Implementada |
| Dashboard overview | `src/app/features/dashboard/pages/overview` | Implementada |
| Payments | `src/app/features/dashboard/pages/payments` | Implementada |
| Customers | `src/app/features/dashboard/pages/customers` | Implementada |
| API Keys | `src/app/features/dashboard/pages/api-keys` | Implementada |
| Webhooks | `src/app/features/dashboard/pages/webhooks` | Implementada |
| Financials | `src/app/features/dashboard/pages/financials` | Parcial/depends on backend coverage |
| Products | `src/app/features/dashboard/pages/products` | Placeholder visual, sem backend equivalente consolidado |
| Settings | `src/app/features/dashboard/pages/settings` | Implementada como tela, com cobertura funcional variável |

## Padrões Atuais

- Roteamento por `loadComponent`
- Injeção funcional e serviços Angular para comunicação com a API
- Uso de Signals em partes relevantes do estado
- Uso de RxJS ainda presente nos serviços de HTTP e autenticação

## Observações

- Não existem `apps/dashboard` e `apps/landing` separados no repositório atual.
- O app assume integração com a API principal em `http://localhost:3000/api/v1` por meio dos serviços Angular.

## Scripts

```bash
pnpm dev
pnpm build
pnpm test
```

[Voltar ao README raiz](../../README.md)
