# Hockpay — Modelagem de Dados

Legenda:

- `Implementado`: presente no Prisma e com cobertura runtime relevante
- `Parcial`: presente no schema, mas incompleto na camada de domínio/API/UI
- `Planejado`: alvo ainda não consolidado no código

## 1. Modelo Atual do Prisma

O schema atual em `packages/database/prisma/schema.prisma` inclui os principais grupos abaixo.

### 1.1 Identidade e autenticação

| Entidade | Status | Observações |
|----------|--------|-------------|
| `Merchant` | Implementado | Login por email/senha |
| `RefreshToken` | Implementado | Sessão do dashboard |
| `ApiKey` | Implementado | Autenticação pública por store/ambiente |
| `IdempotencyKey` | Implementado | Persistência da camada de idempotência |

### 1.2 Estrutura de negócio

| Entidade | Status | Observações |
|----------|--------|-------------|
| `Store` | Implementado | Contexto principal de escopo |
| `Customer` | Implementado | Criado on-the-fly em pagamentos quando necessário |
| `Payment` | Implementado | Aggregate central dos fluxos Pix simulados |
| `CheckoutSession` | Implementado | Base do checkout hospedado |
| `WebhookConfig` | Implementado | Configuração de destino de webhooks |
| `WebhookLog` | Implementado | Log de tentativas/entregas |
| `OutboxEvent` | Implementado | Fonte do pipeline assíncrono |

### 1.3 Financeiro

| Entidade | Status | Observações |
|----------|--------|-------------|
| `Account` | Implementado | Criada automaticamente no bootstrap de store; migration cobre stores antigas sem account |
| `Transaction` | Implementado | Usada em métricas, release e refunds |
| `Refund` | Implementado | Runtime atual suporta reembolso parcial |
| `BankAccount` | Implementado | CRUD disponível na API |
| `Withdrawal` | Parcial | Presente no schema, não aparece como capacidade consolidada na API atual |
| `Receipt` / `ReceiptCounter` | Implementado | Emitidos no fluxo de pagamento confirmado e consultáveis pela timeline/detalhe de payment |

### 1.4 Catálogo

| Entidade | Status | Observações |
|----------|--------|-------------|
| `Product` | Parcial | Existe no schema, mas não há slice completo no backend atual |
| `PaymentItem` | Parcial | Existe no schema, mas não participa do fluxo atual de criação de pagamento |

## 2. Cobertura Runtime Atual

### 2.1 Entidades com cobertura de ponta a ponta

- `Merchant`
- `Store`
- `Customer`
- `Payment`
- `CheckoutSession`
- `WebhookConfig`
- `WebhookLog`
- `OutboxEvent`
- `ApiKey`
- `IdempotencyKey`
- `Refund`
- `BankAccount`
- `Account`
- `Transaction`
- `Receipt`

### 2.2 Entidades com cobertura parcial

#### `Product` e `PaymentItem`

- Existem no Prisma
- Há rota visual para `products` no dashboard Angular
- O backend atual não expõe um módulo equivalente de catálogo/produtos
- O fluxo atual de `CreatePaymentUseCase` não recebe itens de carrinho

#### `Withdrawal`

- Existe no schema
- A documentação histórica descrevia saques como parte do domínio
- O estado atual não a trata como capacidade consolidada no conjunto de READMEs e fluxos principais

## 3. Regras Atuais Verificadas no Código

### 3.1 Payment

- `Payment` pertence a `Store` e `Customer`, não diretamente a `Merchant`
- Estados atuais no schema:
  - `PENDING`
  - `CONFIRMED`
  - `RELEASED`
  - `EXPIRED`
  - `FAILED`
  - `REFUNDED`
- `CreatePaymentUseCase`:
  - valida store
  - cria customer se não existir
  - calcula taxa
  - gera QR/copia-e-cola
  - grava `OutboxEvent`
  - agenda expiração

### 3.2 Refund

- O runtime atual aceita valor de estorno (`amount`)
- Isso torna o fluxo de refund parcial possível
- A documentação antiga que afirmava “sempre total” estava incorreta para o código atual

### 3.3 Store

- `Store.create()` por padrão nasce com `settlementDays = 30`, `feePercent = 1.5`, `feeFixed = 15`
- O `CreateStoreUseCase` atual marca stores novas como `isApproved: true` para o MVP atual
- Isso diverge do texto antigo que descrevia aprovação administrativa posterior como fluxo atual
- Toda store criada pela API nasce com uma `Account`; a migration de backfill cobre stores antigas sem account

### 3.4 Receipt, timeline e financeiro

- Pagamento confirmado gera receipt e transaction de recebimento conforme o fluxo financeiro atual
- `GET /api/v1/payments/:id/timeline` agrega payment, checkout session, receipt, refunds, transactions e webhook logs sanitizados
- `/dashboard/payments/:id` e `/dashboard/financials` permitem validar receipt, timeline operacional, ledger e saldos sem abrir o banco

## 4. Modelo Alvo

O alvo mais coerente com o repositório é:

- alinhar schema e runtime para todas as entidades já expostas como parte do domínio
- decidir explicitamente se `Product`/`PaymentItem` continuarão no produto
- manter `Withdrawal` como futuro explícito até virar fluxo financeiro completo

### 4.1 Alvos por área

| Área | Alvo |
|------|------|
| Financeiro | manter account, receipt, transaction, refund, release e timeline alinhados entre schema, use cases, API, dashboard e docs |
| Catálogo | implementar end-to-end ou tratar como futuro explícito |
| Store bootstrap | preservar account auto-created como invariante de store |
| Withdrawals | só promover em docs principais quando o runtime estiver maduro |

## 5. Gaps Prioritários

1. `Product` e `PaymentItem` têm presença forte no schema, mas fraca no runtime.
2. `Withdrawal` existe no schema, mas não deve ser documentado como fluxo financeiro consolidado.
3. Marketplace, split e multi-seller exigem PRD próprio antes de aparecerem como produto pronto.
4. A documentação antiga descrevia fluxos administrativos e operacionais que hoje são alvo, não realidade atual.

## 6. Fonte Atual de Verdade

- Schema atual: `packages/database/prisma/schema.prisma`
- Cobertura de domínio: `packages/core/src`
- Cobertura HTTP: `apps/api/src/modules`
- Cobertura de UI: `apps/web/src/app` e `apps/checkout/src`
