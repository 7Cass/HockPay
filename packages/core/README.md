# @hockpay/core

Camada de domínio e aplicação do Hockpay, seguindo Clean Architecture.

## Estrutura

```
src/
├── domain/           # Camada de domínio (sem dependências externas)
│   ├── entities/     # Entidades de negócio
│   ├── value-objects/# Objetos de valor
│   ├── repositories/ # Interfaces de repositories
│   ├── events/       # Domain events
│   ├── errors/       # Erros de domínio
│   └── constants/    # Constantes de domínio
│
└── application/      # Camada de aplicação
    ├── use-cases/    # Casos de uso
    ├── services/     # Serviços de aplicação
    └── ports/        # Interfaces para infraestrutura
```

## Regra de Dependência

```
Domain → Application → Infrastructure ← Presentation
```

- **Domain** não depende de nada externo
- **Application** depende apenas de Domain
- **Infrastructure** implementa interfaces de Application

## Entidades

| Entidade | Descrição |
|----------|-----------|
| `Merchant` | Conta do usuário |
| `Store` | Loja do merchant |
| `ApiKey` | Chave de API |
| `Customer` | Cliente da loja |
| `Payment` | Transação Pix |
| `Account` | Conta financeira |
| `Transaction` | Movimentação |
| `WebhookConfig` | Configuração de webhook |
| `WebhookLog` | Log de entrega |
| `OutboxEvent` | Evento para outbox pattern |
| `IdempotencyKey` | Cache de idempotência |

## Use Cases

### Autenticação

| Use Case | Descrição |
|----------|-----------|
| `LoginUseCase` | Autenticar merchant |
| `LogoutUseCase` | Invalidar sessão |
| `RefreshTokenUseCase` | Renovar access token |

### Pagamentos

| Use Case | Descrição |
|----------|-----------|
| `CreatePaymentUseCase` | Criar novo pagamento |
| `ConfirmPaymentUseCase` | Confirmar pagamento |
| `ExpirePaymentUseCase` | Expirar pagamento |
| `FailPaymentUseCase` | Marcar como falho |
| `ReleasePaymentUseCase` | Liberar para saque |

### Webhooks

| Use Case | Descrição |
|----------|-----------|
| `ProcessWebhookUseCase` | Processar webhook |
| `CreateWebhookConfigUseCase` | Criar configuração |
| `TestWebhookConfigUseCase` | Testar endpoint |

## Exemplo de Uso

```typescript
import { CreatePaymentUseCase, PaymentRepository } from '@hockpay/core';

// Em um controller ou service
const result = await createPaymentUseCase.execute({
  storeId: 'store-uuid',
  amount: 1500,
  customer: {
    name: 'João Silva',
    email: 'joao@email.com',
    document: '12345678900'
  }
});

console.log(result.payment.id);       // UUID do pagamento
console.log(result.payment.pixQrCode); // QR Code Pix
```

## Scripts

```bash
pnpm build     # Build com tsup
pnpm test      # Testes com Vitest
pnpm test:cov  # Cobertura de testes
```

---

[Voltar para README principal](../../README.md)
