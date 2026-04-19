# `@hockpay/database`

Pacote responsável pelo schema Prisma, migrations e cliente compartilhado.

## Estado Atual

- Banco-alvo: PostgreSQL
- ORM: Prisma
- Fonte de verdade do schema: `prisma/schema.prisma`
- Migrations versionadas em `prisma/migrations`

## Entidades mais relevantes no schema atual

- `Merchant`
- `Store`
- `ApiKey`
- `Customer`
- `Payment`
- `CheckoutSession`
- `WebhookConfig`
- `WebhookLog`
- `OutboxEvent`
- `Account`
- `Transaction`
- `Refund`
- `BankAccount`
- `Receipt`
- `Product`
- `PaymentItem`
- `Withdrawal`

## Scripts Reais

```bash
pnpm run db:generate
pnpm run db:migrate:dev
pnpm run db:migrate:deploy
pnpm run db:push
pnpm run db:studio
pnpm run db:seed
```

## Observação Importante

O script `db:seed` existe no `package.json`, mas o arquivo `prisma/seed.ts` não está presente no repositório atual. Portanto, esse script não deve ser tratado como fluxo operacional confiável até que o seed seja implementado.

## Importação do Cliente

```ts
import { PrismaClient } from '@hockpay/database';
```

[Voltar ao README raiz](../../README.md)
