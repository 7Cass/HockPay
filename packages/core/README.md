# 🧠 `@hockpay/core`

Este pacote é o coração do Hockpay. Seguindo os princípios da **Clean Architecture (Arquitetura Limpa)**, ele isola completamente as regras de negócio das tecnologias de entrega (HTTP, Banco de Dados, UI, Filas). 

> Zero dependências de frameworks como NestJS, Express ou bibliotecas de banco como Prisma. O Core é puro TypeScript.

## 🏗️ Estrutura de Diretórios

O código é unicamente dividido em duas camadas principais:

### 1. `domain/` (Círculo mais interno)
Não tem conhecimento da existência de nenhuma outra camada do software.
- **Entidades**: Lógica agregadora, encapsula estado. Ex: `Payment`, `Merchant`, `WebhookConfig`.
- **Value Objects**: Objetos imutáveis com validação própria. Ex: `Money`, `PixKey`, `Email`.
- **Domain Events**: Eventos engatilhados por mudanças de domínio. Ex: `payment.confirmed`.
- **Errors**: Erros tratáveis de domínio (ex: `InvalidStatusTransitionError`).
- **Repositories (Interfaces)**: Contratos determinando como a infraestrutura **deve** lidar com persistência de dados.

### 2. `application/` (Camada de Casos de Uso)
Orquestra o domínio. Tem dependência exclusiva da pasta `domain/`.
- **Use Cases**: O fluxo do processo de negócio em si. Ex: `CreatePaymentUseCase`, `ConfirmPaymentUseCase`.
- **Services**: Lógica de aplicação compartilhada por Casos de Uso.
- **Ports**: Interfaces de infraestrutura adicionais (Queue, Cache, HashProvider).

## 🔀 Regra de Dependência (Inversão de Controle)

A arquitetura dita a direção do acoplamento:
```text
(Core) Domain ← Application ← // Limite do Pacote // ← Infrastructure ← Presentation
```

A infraestrutura e os controllers (ver `apps/api`) devem se adaptar ao Core implementando suas interfaces (Ports/Repositories), e nunca o contrário.

## 🔑 Principais Entidades

| Agregado / Entidade | Descrição do Estado |
|---------------------|---------------------|
| `Merchant` | Representação do usuário e credenciais no sistema. |
| `Store` | Contexto de loja para um merchant. |
| `ApiKey` | Identificador público para ambiente (Live/Test). |
| `Payment` | Máquina de estados da transação Pix (PENDING, CONFIRMED, EXPIRED, FAILED). |
| `Account` / `Transaction` | Conta financeira virtual e histórico de movimentações. |
| `OutboxEvent` / `WebhookLog` | Eventos atrelados ao disparo resiliente de Webhooks. |

## 💻 Exemplo Prático (Uso de Caso)

```typescript
import { CreatePaymentUseCase, PaymentRepository } from '@hockpay/core';

// Dependências injetadas (implementadas fora do Core)
const createPaymentUseCase = new CreatePaymentUseCase(
  paymentRepository, 
  qrCodeGenerator,
  idempotencyService
);

// Execução pura da regra de negócio
const result = await createPaymentUseCase.execute({
  merchantId: 'merchant-uuid',
  amount: 1500, // 15.00 BRL
  currency: 'BRL',
  customer: {
    name: 'Jane Doe',
    email: 'jane@email.com',
    document: '12345678900' // CPF
  }
});
```

## 🛠️ Comandos Locais

```bash
pnpm build     # Build via TSUp (Gera /dist em ESM/CJS)
pnpm test      # Roda suíte unitária pura (Vitest)
pnpm test:cov  # Cobertura de testes exigida > 85%
```

---

[⬅️ Voltar para o monorepo raiz](../../README.md)
