# @hockpay/infrastructure

Implementações concretas de repositories e serviços de infraestrutura.

## Estrutura

```
src/
├── repositories/           # Implementações de repositories
│   ├── payment.repository.ts
│   ├── outbox.repository.ts
│   ├── webhook-config.repository.ts
│   ├── webhook-log.repository.ts
│   └── idempotency-key.repository.ts
│
└── services/               # Serviços de infraestrutura
    └── encryption.service.ts
```

## Repositories

| Repository | Interface | Descrição |
|------------|-----------|-----------|
| `PaymentRepository` | `IPaymentRepository` | CRUD de pagamentos |
| `OutboxRepository` | `IOutboxRepository` | Eventos de outbox |
| `WebhookConfigRepository` | `IWebhookConfigRepository` | Configurações de webhook |
| `WebhookLogRepository` | `IWebhookLogRepository` | Logs de entrega |
| `IdempotencyKeyRepository` | `IIdempotencyKeyRepository` | Cache de idempotência |

## Dependências

- `@hockpay/core` - Interfaces de repositories
- `@hockpay/database` - Prisma client

## Exemplo

```typescript
// Implementação de IPaymentRepository
import { IPaymentRepository, Payment } from '@hockpay/core';
import { PrismaService } from '@hockpay/database';

@Injectable()
export class PaymentRepository implements IPaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Payment | null> {
    const data = await this.prisma.payment.findUnique({
      where: { id },
      include: { customer: true, items: true }
    });

    return data ? this.toDomain(data) : null;
  }

  async save(payment: Payment): Promise<void> {
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: payment.status }
    });
  }
}
```

## Scripts

```bash
pnpm build     # Build com tsup
pnpm dev       # Build em watch mode
```

---

[Voltar para README principal](../../README.md)
