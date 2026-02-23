# @hockpay/database

Schema Prisma e migrations do Hockpay.

## Estrutura

```
├── prisma/
│   ├── schema.prisma     # Schema do banco
│   ├── migrations/       # Migrations geradas
│   └── seed.ts           # Dados iniciais
│
└── src/
    ├── index.ts          # Exports
    ├── prisma.service.ts # Serviço NestJS
    └── generated/        # Prisma Client gerado
```

## Modelos

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Merchant   │────<│    Store    │────<│   ApiKey    │
└─────────────┘     └─────────────┘     └─────────────┘
                          │
                          │
    ┌─────────────────────┼─────────────────────┐
    │                     │                     │
    ▼                     ▼                     ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Account   │     │  Customer   │     │ WebhookCfg  │
└─────────────┘     └─────────────┘     └─────────────┘
    │                     │
    │                     │
    ▼                     ▼
┌─────────────┐     ┌─────────────┐
│ Transaction │     │   Payment   │
└─────────────┘     └─────────────┘
```

## Enums

| Enum | Valores |
|------|---------|
| `Environment` | `TEST`, `LIVE` |
| `PaymentStatus` | `PENDING`, `CONFIRMED`, `RELEASED`, `EXPIRED`, `FAILED`, `REFUNDED` |
| `RefundStatus` | `PENDING`, `PROCESSED`, `FAILED` |
| `WithdrawalStatus` | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` |
| `TransactionType` | `PAYMENT_RECEIVED`, `PAYMENT_RELEASED`, `REFUND_DEDUCTED`, ... |
| `PixKeyType` | `CPF`, `CNPJ`, `EMAIL`, `PHONE`, `RANDOM` |
| `OutboxStatus` | `PENDING`, `PROCESSED`, `FAILED` |

## Comandos Prisma

```bash
pnpm db:generate         # Gera Prisma Client
pnpm db:migrate:dev      # Cria e roda migration (dev)
pnpm db:migrate:deploy   # Deploya migrations (prod)
pnpm db:push             # Push schema (sem migration)
pnpm db:studio           # Abre Prisma Studio
pnpm db:seed             # Popula dados iniciais
```

## Uso

```typescript
import { PrismaService, PaymentStatus } from '@hockpay/database';

@Module({
  providers: [PrismaService],
})
export class AppModule {}

// Em um service
const payment = await this.prisma.payment.findUnique({
  where: { id: 'payment-uuid' },
  include: { customer: true, items: true }
});

const pending = await this.prisma.payment.count({
  where: { status: PaymentStatus.PENDING }
});
```

## Relacionamentos Principais

- **Merchant** → Stores (1:N)
- **Store** → ApiKeys, Customers, Payments, WebhookConfigs (1:N)
- **Store** → Account (1:1)
- **Account** → Transactions, Withdrawals (1:N)
- **Customer** → Payments (1:N)
- **Payment** → PaymentItems, WebhookLogs, Refund (1:N)
- **WebhookConfig** → WebhookLogs (1:N)

---

[Voltar para README principal](../../README.md) | [Ver DATA_MODELING.md](../../DATA_MODELING.md)
