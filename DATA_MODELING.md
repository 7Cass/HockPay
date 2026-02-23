# Hockpay — Modelagem de Dados

> Documento detalhado da modelagem de dados, entidades, relacionamentos e regras de negócio.

---

## Índice

1. [Visão Geral do Domínio](#1-visão-geral-do-domínio)
2. [Diagrama de Entidades](#2-diagrama-de-entidades)
3. [Entidades Detalhadas](#3-entidades-detalhadas)
4. [Prisma Schema](#4-prisma-schema)
5. [Regras de Negócio](#5-regras-de-negócio)
6. [Padrão Outbox](#6-padrão-outbox)
7. [Jobs Assíncronos](#7-jobs-assíncronos)
8. [Fluxos de Dados](#8-fluxos-de-dados)
9. [Índices e Performance](#9-índices-e-performance)

---

## 1. Visão Geral do Domínio

### 1.1 Hierarquia Principal

```
Merchant (pessoa)
    └── Store (projeto/loja)
            ├── Account (saldo) ← criada automaticamente
            ├── ApiKey (autenticação)
            ├── BankAccount (conta para saque)
            ├── Customer (cliente final)
            ├── Product (produto)
            ├── Payment (pagamento)
            ├── Refund (estorno)
            └── Withdrawal (saque)
```

### 1.2 Conceitos Chave

| Conceito        | Descrição                                                       |
| --------------- | --------------------------------------------------------------- |
| **Merchant**    | Pessoa física que usa o Hockpay. Pode ter múltiplas Stores.     |
| **Store**       | Projeto/loja do merchant. Isolamento completo de dados e saldo. |
| **Account**     | Conta financeira da Store. Criada automaticamente com a Store.  |
| **Customer**    | Cliente final que paga. **Obrigatório** em todo Payment.        |
| **Product**     | Produto cadastrado para métricas. Opcional no PaymentItem.      |
| **Payment**     | Cobrança Pix. Pode ter múltiplos produtos (carrinho).           |
| **Transaction** | Log de movimentação financeira. Extrato da Account.             |
| **Refund**      | Estorno de um pagamento. Sempre total.                          |
| **Withdrawal**  | Saque do saldo disponível para conta bancária.                  |
| **OutboxEvent** | Eventos para processamento assíncrono (padrão Outbox).          |

### 1.3 Configurações do Sistema

| Configuração               | Valor          | Observação                     |
| -------------------------- | -------------- | ------------------------------ |
| Taxa padrão                | 1.5% + R$ 0,15 | Configurável por Store (admin) |
| Taxa de saque              | R$ 0,00        | Inicial                        |
| Liberação (conta nova)     | D+30           | Até aprovação por admin        |
| Liberação (conta aprovada) | D+1            | Após análise manual            |
| Janela de estorno          | 30 dias        | Após pagamento confirmado      |
| Expiração Pix              | 30 minutos     | Padrão                         |
| Idempotency TTL            | 24 horas       | Usar nova key para corrigir    |

---

## 2. Diagrama de Entidades

### 2.1 Diagrama Completo

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    HOCKPAY DOMAIN                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─────────────────┐                                                                │
│  │    Merchant     │                                                                │
│  │─────────────────│                                                                │
│  │ id              │                                                                │
│  │ email           │                                                                │
│  │ password_hash   │                                                                │
│  │ name            │                                                                │
│  │ document (CPF)  │                                                                │
│  │ is_active       │                                                                │
│  └────────┬────────┘                                                                │
│           │ 1:N                                                                     │
│           ▼                                                                         │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐              │
│  │     Store       │ 1:N  │     ApiKey      │      │   BankAccount   │              │
│  │─────────────────│─────▶│─────────────────│      │─────────────────│              │
│  │ id              │      │ id              │      │ id              │              │
│  │ merchant_id     │      │ store_id        │      │ store_id        │              │
│  │ name            │      │ key_hash        │      │ pix_key         │              │
│  │ slug            │      │ prefix          │      │ pix_key_type    │              │
│  │ is_approved     │      │ environment     │      │ holder_name     │              │
│  │ settlement_days │      │ revoked_at      │      │ is_default      │              │
│  │ fee_percent     │      └─────────────────┘      └─────────────────┘              │
│  │ fee_fixed       │                                       ▲                        │
│  └────────┬────────┘                                       │                        │
│           │                                                │                        │
│           │ 1:1 (auto-created)                             │                        │
│           ▼                                                │                        │
│  ┌─────────────────┐      ┌─────────────────┐              │                        │
│  │    Account      │ 1:N  │   Transaction   │              │                        │
│  │─────────────────│─────▶│─────────────────│              │                        │
│  │ id              │      │ id              │              │                        │
│  │ store_id (uniq) │      │ account_id      │              │                        │
│  │ available       │      │ type            │              │                        │
│  │ pending         │      │ amount          │              │                        │
│  │ blocked         │      │ balance_after   │              │                        │
│  └────────┬────────┘      │ reference_type  │              │                        │
│           │               │ reference_id    │              │                        │
│           │ 1:N           └─────────────────┘              │                        │
│           ▼                                                │                        │
│  ┌─────────────────┐                                       │                        │
│  │   Withdrawal    │───────────────────────────────────────┘                        │
│  │─────────────────│       (bank_account_id)                                        │
│  │ id              │                                                                │
│  │ account_id      │ ◄── Só account_id (sem store_id redundante)                    │
│  │ bank_account_id │                                                                │
│  │ amount          │                                                                │
│  │ status          │                                                                │
│  └─────────────────┘                                                                │
│                                                                                     │
│  ┌─────────────────┐      ┌─────────────────┐                                       │
│  │    Customer     │      │    Product      │                                       │
│  │─────────────────│      │─────────────────│                                       │
│  │ id              │      │ id              │                                       │
│  │ store_id        │      │ store_id        │                                       │
│  │ document (req)  │      │ name            │                                       │
│  │ name            │      │ price           │                                       │
│  │ email           │      │ is_active       │                                       │
│  └────────┬────────┘      └────────┬────────┘                                       │
│           │                        │                                                │
│           │ 1:N (obrigatório)      │ N:M (via PaymentItem)                          │
│           ▼                        ▼                                                │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐              │
│  │    Payment      │ 1:N  │  PaymentItem    │      │     Refund      │              │
│  │─────────────────│─────▶│─────────────────│      │─────────────────│              │
│  │ id              │      │ id              │      │ id              │              │
│  │ store_id        │      │ payment_id      │      │ payment_id      │              │
│  │ customer_id ◄───│──────│ product_id (opt)│      │ amount          │              │
│  │ (OBRIGATÓRIO)   │      │ quantity        │      │ status          │              │
│  │ amount          │      │ unit_price      │      │ processed_at    │              │
│  │ fee             │      └─────────────────┘      └─────────────────┘              │
│  │ net_amount      │                                       ▲                        │
│  │ status          │◀──────────────────────────────────────┘                        │
│  │ expires_at      │               0:1                                              │
│  │ paid_at         │                                                                │
│  │ released_at     │                                                                │
│  └─────────────────┘                                                                │
│                                                                                     │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐              │
│  │ WebhookConfig   │ 1:N  │  WebhookLog     │      │  OutboxEvent    │              │
│  │─────────────────│─────▶│─────────────────│      │─────────────────│              │
│  │ id              │      │ id              │      │ id              │              │
│  │ store_id        │      │ config_id ──────│──┐   │ aggregate_type  │              │
│  │ url             │      │ payment_id      │  │   │ aggregate_id    │              │
│  │ secret          │      │ event_type      │  │   │ event_type      │              │
│  │ events[]        │◀─────│ attempt         │  │   │ payload         │              │
│  │ is_active       │      │ delivered_at    │  │   │ status          │              │
│  └─────────────────┘      └─────────────────┘  │   │ retry_count     │              │
│                                  ▲             │   │ next_retry_at   │              │
│                                  │             │   └─────────────────┘              │
│                                  └─────────────┘                                    │
│                                 (relation corrigida)                                │
│                                                                                     │
│  ┌─────────────────┐                                                                │
│  │ IdempotencyKey  │                                                                │
│  │─────────────────│                                                                │
│  │ id              │                                                                │
│  │ key + store_id  │ ◄── unique constraint                                          │
│  │ request_hash    │                                                                │
│  │ response_body   │                                                                │
│  │ expires_at      │ ◄── 24h TTL                                                    │
│  └─────────────────┘                                                                │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Relacionamentos

| Entidade A    | Relação | Entidade B    | Descrição                          |
| ------------- | ------- | ------------- | ---------------------------------- |
| Merchant      | 1:N     | Store         | Merchant pode ter várias lojas     |
| Store         | 1:1     | Account       | Criada automaticamente com a Store |
| Store         | 1:N     | ApiKey        | Várias keys por ambiente           |
| Store         | 1:N     | Customer      | Clientes são por loja              |
| Store         | 1:N     | WebhookConfig | Múltiplas configs por loja         |
| Account       | 1:N     | Transaction   | Extrato de movimentações           |
| Account       | 1:N     | Withdrawal    | Saques da conta                    |
| Customer      | 1:N     | Payment       | **Obrigatório**                    |
| Payment       | 0:1     | Refund        | Um estorno por pagamento           |
| WebhookConfig | 1:N     | WebhookLog    | Logs com relation corrigida        |

---

## 3. Entidades Detalhadas

### 3.1 Merchant

| Campo         | Tipo     | Obrigatório | Descrição               |
| ------------- | -------- | ----------- | ----------------------- |
| id            | UUID     | Sim         | Identificador único     |
| email         | String   | Sim         | Email único para login  |
| password_hash | String   | Sim         | Senha hasheada (bcrypt) |
| name          | String   | Sim         | Nome completo           |
| document      | String   | Sim         | CPF                     |
| is_active     | Boolean  | Sim         | Se a conta está ativa   |
| created_at    | DateTime | Sim         | Data de criação         |
| updated_at    | DateTime | Sim         | Última atualização      |

### 3.2 Store

| Campo           | Tipo     | Obrigatório | Descrição                          |
| --------------- | -------- | ----------- | ---------------------------------- |
| id              | UUID     | Sim         | Identificador único                |
| merchant_id     | UUID     | Sim         | FK para Merchant                   |
| name            | String   | Sim         | Nome da loja                       |
| slug            | String   | Sim         | Identificador URL-friendly (único) |
| is_active       | Boolean  | Sim         | Se está ativa                      |
| is_approved     | Boolean  | Sim         | Se foi aprovada por admin          |
| settlement_days | Int      | Sim         | Dias para liberar saldo (D+N)      |
| fee_percent     | Decimal  | Sim         | Taxa percentual (padrão: 1.5)      |
| fee_fixed       | Int      | Sim         | Taxa fixa em centavos (padrão: 15) |
| created_at      | DateTime | Sim         | Data de criação                    |
| updated_at      | DateTime | Sim         | Última atualização                 |

**Regras:**

- Ao criar Store, **Account é criada automaticamente**
- `is_approved = false` → `settlement_days = 30`
- Admin aprova → `is_approved = true`, `settlement_days = 1`

### 3.3 Account

| Campo      | Tipo     | Obrigatório | Descrição                                |
| ---------- | -------- | ----------- | ---------------------------------------- |
| id         | UUID     | Sim         | Identificador único                      |
| store_id   | UUID     | Sim         | FK para Store (unique)                   |
| available  | Int      | Sim         | Saldo disponível - **pode ser negativo** |
| pending    | Int      | Sim         | Saldo pendente (centavos)                |
| blocked    | Int      | Sim         | Saldo bloqueado (centavos)               |
| currency   | String   | Sim         | Moeda (BRL)                              |
| updated_at | DateTime | Sim         | Última atualização                       |

**Criada automaticamente** ao criar Store:

```sql
INSERT INTO accounts (store_id, available, pending, blocked, currency)
VALUES (store.id, 0, 0, 0, 'BRL');
```

### 3.4 Transaction

| Campo          | Tipo     | Obrigatório | Descrição                   |
| -------------- | -------- | ----------- | --------------------------- |
| id             | UUID     | Sim         | Identificador único         |
| account_id     | UUID     | Sim         | FK para Account             |
| type           | Enum     | Sim         | Tipo da transação           |
| amount         | Int      | Sim         | Valor (centavos)            |
| fee            | Int      | Não         | Taxa (centavos)             |
| net_amount     | Int      | Sim         | Valor líquido (centavos)    |
| balance_after  | Int      | Sim         | Saldo após transação        |
| reference_type | String   | Não         | payment, refund, withdrawal |
| reference_id   | UUID     | Não         | ID da referência            |
| description    | String   | Não         | Descrição legível           |
| created_at     | DateTime | Sim         | Data da transação           |

**Tipos de Transação:**

| Tipo                 | Descrição                                    |
| -------------------- | -------------------------------------------- |
| PAYMENT_RECEIVED     | Pagamento confirmado (entrada em pending)    |
| PAYMENT_RELEASED     | Saldo liberado (pending → available)         |
| REFUND_DEDUCTED      | Estorno debitado da conta                    |
| NEGATIVE_COMPENSATED | Saldo negativo compensado por novo pagamento |
| WITHDRAWAL_SENT      | Saque enviado                                |
| WITHDRAWAL_REVERSED  | Saque falhou (devolução)                     |
| FEE_CHARGED          | Taxa cobrada                                 |
| ADJUSTMENT           | Ajuste manual (admin)                        |

### 3.5 Customer

| Campo       | Tipo     | Obrigatório | Descrição                       |
| ----------- | -------- | ----------- | ------------------------------- |
| id          | UUID     | Sim         | Identificador único             |
| store_id    | UUID     | Sim         | FK para Store                   |
| external_id | String   | Não         | ID externo do merchant          |
| name        | String   | Não         | Nome                            |
| email       | String   | Não         | Email                           |
| document    | String   | **Sim**     | CPF/CNPJ (obrigatório para Pix) |
| phone       | String   | Não         | Telefone                        |
| metadata    | JSON     | Não         | Dados extras                    |
| created_at  | DateTime | Sim         | Data de criação                 |
| updated_at  | DateTime | Sim         | Última atualização              |

**Nota:** Customer usa `onDelete: Restrict` com Payment. Isso significa que um Customer **não pode ser deletado** se tiver pagamentos associados (compliance/GDPR). Para "deletar", use soft delete.

### 3.6 Product

| Campo       | Tipo     | Obrigatório | Descrição                   |
| ----------- | -------- | ----------- | --------------------------- |
| id          | UUID     | Sim         | Identificador único         |
| store_id    | UUID     | Sim         | FK para Store               |
| external_id | String   | Não         | ID externo do merchant      |
| name        | String   | Sim         | Nome do produto             |
| description | String   | Não         | Descrição                   |
| price       | Int      | Não         | Preço padrão (centavos)     |
| currency    | String   | Sim         | Moeda (BRL)                 |
| image_url   | String   | Não         | URL da imagem               |
| is_active   | Boolean  | Sim         | Se está ativo               |
| created_at  | DateTime | Sim         | Data de criação             |
| updated_at  | DateTime | Sim         | Última atualização          |

**Uso:** Product é opcional. Usado para métricas e pode ser vinculado em PaymentItem. Se não existe, o item é criado com os dados informados.

### 3.7 Payment

| Campo          | Tipo     | Obrigatório | Descrição                          |
| -------------- | -------- | ----------- | ---------------------------------- |
| id             | UUID     | Sim         | Identificador único                |
| store_id       | UUID     | Sim         | FK para Store                      |
| customer_id    | UUID     | **Sim**     | FK para Customer (**obrigatório**) |
| external_id    | String   | Não         | ID externo do merchant             |
| amount         | Int      | Sim         | Valor total (centavos)             |
| fee            | Int      | Sim         | Taxa calculada (centavos)          |
| net_amount     | Int      | Sim         | Valor líquido (centavos)           |
| status         | Enum     | Sim         | Status do pagamento                |
| pix_qr_code    | String   | Não         | QR Code (base64)                   |
| pix_copy_paste | String   | Não         | Código copia e cola                |
| pix_tx_id      | String   | Não         | ID da transação Pix                |
| expires_at     | DateTime | Sim         | Expiração do Pix                   |
| paid_at        | DateTime | Não         | Data do pagamento                  |
| released_at    | DateTime | Não         | Data da liberação (D+N)            |
| metadata       | JSON     | Não         | Dados extras                       |
| created_at     | DateTime | Sim         | Data de criação                    |

**Status:**

| Status    | Descrição                  |
| --------- | -------------------------- |
| PENDING   | Aguardando pagamento       |
| CONFIRMED | Pago, saldo em pending     |
| RELEASED  | Saldo liberado (available) |
| EXPIRED   | Expirado                   |
| FAILED    | Falhou                     |
| REFUNDED  | Estornado                  |

**Notas:**
- `expires_at` é definido na criação do Payment: `now() + 30 minutos`
- `pix_qr_code` e `pix_copy_paste` são gerados na criação (simulado)

### 3.7.1 PaymentItem

| Campo       | Tipo   | Obrigatório | Descrição                    |
| ----------- | ------ | ----------- | ---------------------------- |
| id          | UUID   | Sim         | Identificador único          |
| payment_id  | UUID   | Sim         | FK para Payment              |
| product_id  | UUID   | Não         | FK para Product (opcional)   |
| name        | String | Sim         | Nome do item                 |
| description | String | Não         | Descrição                    |
| quantity    | Int    | Sim         | Quantidade                   |
| unit_price  | Int    | Sim         | Preço unitário (centavos)    |
| total_price | Int    | Sim         | Preço total (centavos)       |

**Regra:** `total_price = unit_price * quantity`

### 3.8 Refund

| Campo        | Tipo     | Obrigatório | Descrição                          |
| ------------ | -------- | ----------- | ---------------------------------- |
| id           | UUID     | Sim         | Identificador único                |
| payment_id   | UUID     | Sim         | FK para Payment (unique)           |
| amount       | Int      | Sim         | Valor estornado (= payment.amount) |
| fee_refunded | Int      | Sim         | Taxa devolvida ao merchant         |
| reason       | String   | Não         | Motivo do estorno                  |
| status       | Enum     | Sim         | PENDING, PROCESSED, FAILED         |
| processed_at | DateTime | Não         | Data do processamento              |
| created_at   | DateTime | Sim         | Data de criação                    |

**Lógica de falha:**

- Se `status = FAILED`, Payment volta ao status anterior (usa `released_at` para determinar: se tem → RELEASED, senão → CONFIRMED)

### 3.8 Withdrawal

| Campo           | Tipo     | Obrigatório | Descrição                              |
| --------------- | -------- | ----------- | -------------------------------------- |
| id              | UUID     | Sim         | Identificador único                    |
| account_id      | UUID     | Sim         | FK para Account                        |
| bank_account_id | UUID     | Sim         | FK para BankAccount                    |
| amount          | Int      | Sim         | Valor solicitado (centavos)            |
| fee             | Int      | Sim         | Taxa de saque (padrão: 0)              |
| net_amount      | Int      | Sim         | Valor líquido (centavos)               |
| status          | Enum     | Sim         | PENDING, PROCESSING, COMPLETED, FAILED |
| pix_e2e_id      | String   | Não         | ID E2E do Pix                          |
| paid_at         | DateTime | Não         | Data do pagamento                      |
| failed_reason   | String   | Não         | Motivo da falha                        |
| created_at      | DateTime | Sim         | Data de criação                        |

**Nota:** `store_id` removido — acesse via `account.storeId`.

### 3.10 WebhookLog

| Campo           | Tipo     | Obrigatório | Descrição               |
| --------------- | -------- | ----------- | ----------------------- |
| id              | UUID     | Sim         | Identificador único     |
| config_id       | UUID     | **Sim**     | FK para WebhookConfig   |
| payment_id      | UUID     | Não         | FK para Payment         |
| event_type      | String   | Sim         | Tipo do evento          |
| payload         | JSON     | Sim         | Payload enviado         |
| response_status | Int      | Não         | HTTP status da resposta |
| attempt         | Int      | Sim         | Número da tentativa     |
| delivered_at    | DateTime | Não         | Quando foi entregue     |
| created_at      | DateTime | Sim         | Data de criação         |

**Notas:**
- `config_id` é **obrigatório** — todo webhook log está associado a uma config
- `config` tem relation para `WebhookConfig` (corrigido)
- WebhookLog é independente do OutboxEvent (histórico de entregas)

### 3.11 OutboxEvent

| Campo          | Tipo     | Obrigatório | Descrição                   |
| -------------- | -------- | ----------- | --------------------------- |
| id             | UUID     | Sim         | Identificador único         |
| aggregate_type | String   | Sim         | payment, refund, withdrawal |
| aggregate_id   | UUID     | Sim         | ID da entidade              |
| event_type     | String   | Sim         | Tipo do evento              |
| payload        | JSON     | Sim         | Dados do evento             |
| status         | Enum     | Sim         | PENDING, PROCESSED, FAILED  |
| processed_at   | DateTime | Não         | Quando foi processado       |
| retry_count    | Int      | Sim         | Número de retries           |
| max_retries    | Int      | Sim         | Máximo de retries (5)       |
| next_retry_at  | DateTime | Não         | Próxima tentativa           |
| error_message  | String   | Não         | Mensagem de erro            |
| created_at     | DateTime | Sim         | Data de criação             |

**Nota Importante:** OutboxEvent **NÃO tem foreign keys** para as entidades (payment, refund, etc). Isso é intencional:
- Evita locks e dependências cíclicas
- Permite deletar a entidade mesmo se o evento falhou
- Worker reconstrói o contexto usando `aggregateType` + `aggregateId`

---

## 4. Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// ENUMS
// ============================================================================

enum Environment {
  TEST
  LIVE
}

enum PaymentStatus {
  PENDING
  CONFIRMED
  RELEASED
  EXPIRED
  FAILED
  REFUNDED
}

enum RefundStatus {
  PENDING
  PROCESSED
  FAILED
}

enum WithdrawalStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

enum TransactionType {
  PAYMENT_RECEIVED
  PAYMENT_RELEASED
  REFUND_DEDUCTED
  NEGATIVE_COMPENSATED
  WITHDRAWAL_SENT
  WITHDRAWAL_REVERSED
  FEE_CHARGED
  ADJUSTMENT
}

enum PixKeyType {
  CPF
  CNPJ
  EMAIL
  PHONE
  RANDOM
}

enum OutboxStatus {
  PENDING
  PROCESSED
  FAILED
}

// ============================================================================
// MERCHANT & AUTH
// ============================================================================

model Merchant {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String    @map("password_hash")
  name          String
  document      String    @unique
  isActive      Boolean   @default(true) @map("is_active")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  stores        Store[]
  refreshTokens RefreshToken[]

  @@map("merchants")
}

model RefreshToken {
  id          String    @id @default(uuid())
  merchantId  String    @map("merchant_id")
  tokenHash   String    @map("token_hash")
  expiresAt   DateTime  @map("expires_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  revokedAt   DateTime? @map("revoked_at")

  merchant    Merchant  @relation(fields: [merchantId], references: [id], onDelete: Cascade)

  @@index([tokenHash])
  @@index([merchantId])
  @@map("refresh_tokens")
}

// ============================================================================
// STORE
// ============================================================================

model Store {
  id              String    @id @default(uuid())
  merchantId      String    @map("merchant_id")
  name            String
  slug            String    @unique
  isActive        Boolean   @default(true) @map("is_active")
  isApproved      Boolean   @default(false) @map("is_approved")
  settlementDays  Int       @default(30) @map("settlement_days")
  feePercent      Decimal   @default(1.5) @map("fee_percent") @db.Decimal(5, 2)
  feeFixed        Int       @default(15) @map("fee_fixed")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  merchant        Merchant  @relation(fields: [merchantId], references: [id], onDelete: Cascade)

  account         Account?
  apiKeys         ApiKey[]
  bankAccounts    BankAccount[]
  customers       Customer[]
  products        Product[]
  payments        Payment[]
  webhookConfigs  WebhookConfig[]
  idempotencyKeys IdempotencyKey[]

  @@index([merchantId])
  @@map("stores")
}

model ApiKey {
  id          String      @id @default(uuid())
  storeId     String      @map("store_id")
  keyHash     String      @map("key_hash")
  prefix      String
  name        String
  environment Environment @default(TEST)
  lastUsedAt  DateTime?   @map("last_used_at")
  createdAt   DateTime    @default(now()) @map("created_at")
  revokedAt   DateTime?   @map("revoked_at")

  store       Store       @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@index([prefix])
  @@index([storeId])
  @@index([keyHash])
  @@map("api_keys")
}

model BankAccount {
  id             String     @id @default(uuid())
  storeId        String     @map("store_id")
  pixKey         String     @map("pix_key")
  pixKeyType     PixKeyType @map("pix_key_type")
  holderName     String     @map("holder_name")
  holderDocument String     @map("holder_document")
  isDefault      Boolean    @default(false) @map("is_default")
  isVerified     Boolean    @default(false) @map("is_verified")
  createdAt      DateTime   @default(now()) @map("created_at")
  updatedAt      DateTime   @updatedAt @map("updated_at")

  store          Store      @relation(fields: [storeId], references: [id], onDelete: Cascade)
  withdrawals    Withdrawal[]

  @@index([storeId])
  @@map("bank_accounts")
}

// ============================================================================
// ACCOUNT & TRANSACTIONS
// ============================================================================

model Account {
  id          String    @id @default(uuid())
  storeId     String    @unique @map("store_id")
  available   Int       @default(0) // pode ser negativo
  pending     Int       @default(0)
  blocked     Int       @default(0)
  currency    String    @default("BRL")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  store        Store        @relation(fields: [storeId], references: [id], onDelete: Cascade)
  transactions Transaction[]
  withdrawals  Withdrawal[]

  @@map("accounts")
}

model Transaction {
  id            String          @id @default(uuid())
  accountId     String          @map("account_id")
  type          TransactionType
  amount        Int
  fee           Int             @default(0)
  netAmount     Int             @map("net_amount")
  balanceAfter  Int             @map("balance_after")
  referenceType String?         @map("reference_type")
  referenceId   String?         @map("reference_id")
  description   String?
  createdAt     DateTime        @default(now()) @map("created_at")

  account       Account         @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([accountId])
  @@index([referenceType, referenceId])
  @@index([createdAt])
  @@map("transactions")
}

// ============================================================================
// CUSTOMER & PRODUCT
// ============================================================================

model Customer {
  id          String    @id @default(uuid())
  storeId     String    @map("store_id")
  externalId  String?   @map("external_id")
  name        String?
  email       String?
  document    String    // Obrigatório
  phone       String?
  metadata    Json?
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  store       Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  payments    Payment[]

  @@unique([storeId, externalId])
  @@unique([storeId, document])
  @@index([storeId])
  @@map("customers")
}

model Product {
  id          String    @id @default(uuid())
  storeId     String    @map("store_id")
  externalId  String?   @map("external_id")
  name        String
  description String?
  price       Int?
  currency    String    @default("BRL")
  imageUrl    String?   @map("image_url")
  isActive    Boolean   @default(true) @map("is_active")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  store        Store        @relation(fields: [storeId], references: [id], onDelete: Cascade)
  paymentItems PaymentItem[]

  @@unique([storeId, externalId])
  @@index([storeId])
  @@map("products")
}

// ============================================================================
// PAYMENT
// ============================================================================

model Payment {
  id            String        @id @default(uuid())
  storeId       String        @map("store_id")
  customerId    String        @map("customer_id") // Obrigatório
  externalId    String?       @map("external_id")
  amount        Int
  fee           Int
  netAmount     Int           @map("net_amount")
  currency      String        @default("BRL")
  description   String?
  status        PaymentStatus @default(PENDING)
  pixQrCode     String?       @map("pix_qr_code") @db.Text
  pixCopyPaste  String?       @map("pix_copy_paste") @db.Text
  pixTxId       String?       @map("pix_tx_id")
  checkoutUrl   String?       @map("checkout_url")
  expiresAt     DateTime      @map("expires_at")
  paidAt        DateTime?     @map("paid_at")
  releasedAt    DateTime?     @map("released_at")
  failedReason  String?       @map("failed_reason")
  metadata      Json?
  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt @map("updated_at")

  store         Store         @relation(fields: [storeId], references: [id], onDelete: Cascade)
  customer      Customer      @relation(fields: [customerId], references: [id], onDelete: Restrict)

  items         PaymentItem[]
  refund        Refund?
  webhookLogs   WebhookLog[]

  @@unique([storeId, externalId])
  @@index([storeId])
  @@index([customerId])
  @@index([status])
  @@index([pixTxId])
  @@index([expiresAt])
  @@index([createdAt])
  @@map("payments")
}

model PaymentItem {
  id          String    @id @default(uuid())
  paymentId   String    @map("payment_id")
  productId   String?   @map("product_id")
  name        String
  description String?
  quantity    Int       @default(1)
  unitPrice   Int       @map("unit_price")
  totalPrice  Int       @map("total_price")

  payment     Payment   @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  product     Product?  @relation(fields: [productId], references: [id], onDelete: SetNull)

  @@index([paymentId])
  @@map("payment_items")
}

// ============================================================================
// REFUND
// ============================================================================

model Refund {
  id          String       @id @default(uuid())
  paymentId   String       @unique @map("payment_id")
  amount      Int
  feeRefunded Int          @default(0) @map("fee_refunded")
  reason      String?
  status      RefundStatus @default(PENDING)
  processedAt DateTime?    @map("processed_at")
  createdAt   DateTime     @default(now()) @map("created_at")

  payment     Payment      @relation(fields: [paymentId], references: [id], onDelete: Cascade)

  @@index([status])
  @@map("refunds")
}

// ============================================================================
// WITHDRAWAL (sem store_id redundante)
// ============================================================================

model Withdrawal {
  id            String           @id @default(uuid())
  accountId     String           @map("account_id")
  bankAccountId String           @map("bank_account_id")
  amount        Int
  fee           Int              @default(0)
  netAmount     Int              @map("net_amount")
  status        WithdrawalStatus @default(PENDING)
  pixE2eId      String?          @map("pix_e2e_id")
  paidAt        DateTime?        @map("paid_at")
  failedReason  String?          @map("failed_reason")
  createdAt     DateTime         @default(now()) @map("created_at")
  updatedAt     DateTime         @updatedAt @map("updated_at")

  account       Account          @relation(fields: [accountId], references: [id], onDelete: Cascade)
  bankAccount   BankAccount      @relation(fields: [bankAccountId], references: [id], onDelete: Restrict)

  @@index([accountId])
  @@index([status])
  @@map("withdrawals")
}

// ============================================================================
// WEBHOOKS (relation config corrigida)
// ============================================================================

model WebhookConfig {
  id          String    @id @default(uuid())
  storeId     String    @map("store_id")
  url         String
  secret      String
  events      String[]
  isActive    Boolean   @default(true) @map("is_active")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  store       Store        @relation(fields: [storeId], references: [id], onDelete: Cascade)
  webhookLogs WebhookLog[]

  @@index([storeId])
  @@map("webhook_configs")
}

model WebhookLog {
  id             String    @id @default(uuid())
  configId       String    @map("config_id")
  paymentId      String?   @map("payment_id")
  eventType      String    @map("event_type")
  payload        Json
  requestHeaders Json?     @map("request_headers")
  responseStatus Int?      @map("response_status")
  responseBody   String?   @map("response_body") @db.Text
  attempt        Int       @default(1)
  maxAttempts    Int       @default(5) @map("max_attempts")
  nextRetryAt    DateTime? @map("next_retry_at")
  deliveredAt    DateTime? @map("delivered_at")
  createdAt      DateTime  @default(now()) @map("created_at")

  config         WebhookConfig @relation(fields: [configId], references: [id], onDelete: Cascade)
  payment        Payment?      @relation(fields: [paymentId], references: [id], onDelete: SetNull)

  @@index([configId])
  @@index([paymentId])
  @@index([nextRetryAt])
  @@map("webhook_logs")
}

// ============================================================================
// OUTBOX (padrão de mercado)
// ============================================================================

model OutboxEvent {
  id            String       @id @default(uuid())
  aggregateType String       @map("aggregate_type")
  aggregateId   String       @map("aggregate_id")
  eventType     String       @map("event_type")
  payload       Json
  status        OutboxStatus @default(PENDING)
  processedAt   DateTime?    @map("processed_at")
  retryCount    Int          @default(0) @map("retry_count")
  maxRetries    Int          @default(5) @map("max_retries")
  nextRetryAt   DateTime?    @map("next_retry_at")
  errorMessage  String?      @map("error_message")
  createdAt     DateTime     @default(now()) @map("created_at")

  @@index([status, nextRetryAt])
  @@index([aggregateType, aggregateId])
  @@index([createdAt])
  @@map("outbox_events")
}

// ============================================================================
// IDEMPOTENCY
// ============================================================================

model IdempotencyKey {
  id             String   @id @default(uuid())
  key            String
  storeId        String   @map("store_id")
  requestPath    String   @map("request_path")
  requestHash    String   @map("request_hash")
  responseBody   Json     @map("response_body")
  responseStatus Int      @map("response_status")
  createdAt      DateTime @default(now()) @map("created_at")
  expiresAt      DateTime @map("expires_at")

  store          Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@unique([key, storeId])
  @@index([expiresAt])
  @@map("idempotency_keys")
}
```

---

## 5. Regras de Negócio

### 5.0 Criação de Store

```
1. Validar dados da Store
2. Em transaction DB:
   - Criar Store (is_approved=false, settlement_days=30)
   - Criar Account automaticamente (available=0, pending=0, blocked=0)
3. Retornar Store
```

### 5.1 Criação de Pagamento

```
1. Validar API Key → identifica Store
2. Validar Customer (obrigatório, criar se não existe)
3. Calcular taxa:
   fee = (amount * feePercent / 100) + feeFixed
   netAmount = amount - fee
4. Em transaction DB:
   - Criar Payment (PENDING)
   - Criar PaymentItems
   - Criar OutboxEvent (PAYMENT_CREATED)
5. Retornar Payment com QR Code
```

### 5.2 Confirmação de Pagamento

```
1. Receber confirmação (simulada)
2. Em transaction DB:
   - Payment.status = CONFIRMED, paidAt = now()
   - Account.pending += netAmount
   - Transaction (PAYMENT_RECEIVED)
   - OutboxEvent (PAYMENT_CONFIRMED)
3. Worker: dispara webhooks
```

### 5.3 Expiração de Pagamento (Job)

```
Job executado a cada 1 minuto:

1. Buscar: status=PENDING AND expires_at < now()
2. Para cada:
   - Payment.status = EXPIRED
   - OutboxEvent (PAYMENT_EXPIRED)
3. Worker: dispara webhooks
```

### 5.4 Liberação de Saldo (Job D+N)

```
Job executado a cada 5 minutos:

1. Buscar (com JOIN em Store para settlement_days):
   SELECT p.*, s.settlement_days
   FROM payments p
   JOIN stores s ON s.id = p.store_id
   WHERE p.status = 'CONFIRMED'
     AND p.released_at IS NULL
     AND p.paid_at + (s.settlement_days || ' days')::interval <= now()

2. Para cada, em transaction:
   - Account.pending -= netAmount
   - Account.available += netAmount
   - Se available era negativo: Transaction (NEGATIVE_COMPENSATED)
   - Transaction (PAYMENT_RELEASED)
   - Payment.status = RELEASED, released_at = now()
   - OutboxEvent (PAYMENT_RELEASED)
```

### 5.5 Estorno (Refund)

```
Validações (use case):
- Payment existe
- status = CONFIRMED ou RELEASED
- paid_at + 30 dias > now()
- Não existe Refund anterior

Em transaction DB:
- Refund (PENDING)
- Se CONFIRMED: Account.pending -= netAmount
- Se RELEASED: Account.available -= amount (pode ficar negativo)
- Transaction (REFUND_DEDUCTED)
- Payment.status = REFUNDED
- OutboxEvent (REFUND_CREATED)

Worker:
- Processa no PSP (simulado = sucesso)
- Refund.status = PROCESSED
- OutboxEvent (REFUND_PROCESSED)
- Dispara webhooks

Se falha (produção real):
- Reverte Account
- Payment.status = (released_at ? RELEASED : CONFIRMED)
- Refund.status = FAILED
```

### 5.6 Saque (Withdrawal)

```
Validações:
- Account.available > 0
- amount <= available

Em transaction DB:
- Withdrawal (PENDING)
- Account.available -= amount
- Transaction (WITHDRAWAL_SENT)
- OutboxEvent (WITHDRAWAL_CREATED)

Worker:
- Processa Pix
- Se sucesso: COMPLETED
- Se falha: FAILED, reverte Account, Transaction (WITHDRAWAL_REVERSED)
```

---

## 6. Padrão Outbox

### 6.1 Por que Outbox?

Padrão de mercado em gateways de pagamento. Garante consistência entre DB e eventos:

```
┌────────────────────────────────────────────────────────────┐
│                    SEM OUTBOX (problema)                   │
├────────────────────────────────────────────────────────────┤
│  1. Salva no DB            ✓ Sucesso                       │
│  2. Envia para fila/PSP    ✗ Falha (rede, timeout)         │
│                                                            │
│  Resultado: DB atualizado, mas evento perdido!             │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│                    COM OUTBOX (solução)                    │
├────────────────────────────────────────────────────────────┤
│  1. Transaction atômica:                                   │
│     - Salva entidade                                       │
│     - Salva OutboxEvent (PENDING)                          │
│  2. Worker poll:                                           │
│     - Lê eventos PENDING                                   │
│     - Processa (webhook, PSP)                              │
│     - Marca PROCESSED                                      │
│                                                            │
│  Resultado: Consistência garantida (at-least-once)         │
└────────────────────────────────────────────────────────────┘
```

### 6.2 Fluxo do Worker

```
┌─────────────────────────────────────────────────────────────┐
│                     OUTBOX WORKER                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Loop a cada 1 segundo:                                     │
│                                                             │
│  SELECT * FROM outbox_events                                │
│  WHERE status = 'PENDING'                                   │
│    AND (next_retry_at IS NULL OR next_retry_at <= now())    │
│  ORDER BY created_at                                        │
│  LIMIT 100                                                  │
│  FOR UPDATE SKIP LOCKED  ◄── evita contenção                │
│                                                             │
│  Para cada evento:                                          │
│    ├── PAYMENT_CREATED    → dispara webhook                 │
│    ├── PAYMENT_CONFIRMED  → dispara webhook                 │
│    ├── PAYMENT_RELEASED   → dispara webhook                 │
│    ├── REFUND_CREATED     → processa PSP, webhook           │
│    ├── WITHDRAWAL_CREATED → processa Pix                    │
│    └── ...                                                  │
│                                                             │
│  Se sucesso:                                                │
│    status = PROCESSED, processed_at = now()                 │
│                                                             │
│  Se falha:                                                  │
│    retry_count++                                            │
│    next_retry_at = now() + backoff                          │
│    Se retry_count >= max_retries: status = FAILED           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Tipos de Evento

| Evento               | Ação                           |
| -------------------- | ------------------------------ |
| PAYMENT_CREATED      | Dispara webhook para cada config ativa |
| PAYMENT_CONFIRMED    | Dispara webhook para cada config ativa |
| PAYMENT_RELEASED     | Dispara webhook para cada config ativa |
| PAYMENT_EXPIRED      | Dispara webhook para cada config ativa |
| REFUND_CREATED       | Processa PSP → dispara webhook |
| REFUND_PROCESSED     | Dispara webhook                |
| WITHDRAWAL_CREATED   | Processa Pix                   |
| WITHDRAWAL_COMPLETED | Dispara webhook                |
| WITHDRAWAL_FAILED    | Dispara webhook                |

**Múltiplos Webhooks:** Uma Store pode ter múltiplas `WebhookConfig`. Ao processar um evento:
1. Buscar todas as configs ativas (`is_active=true`) da Store
2. Verificar se o evento está na lista `events[]` da config
3. Criar um `WebhookLog` para cada config
4. Enviar para cada URL

### 6.4 Retry com Backoff

| Tentativa | Delay    |
| --------- | -------- |
| 1         | Imediato |
| 2         | 1 min    |
| 3         | 5 min    |
| 4         | 30 min   |
| 5         | 2 horas  |

Após 5 falhas: `status = FAILED`, alerta admin.

### 6.5 Outbox → WebhookLog

**Fluxo completo de processamento:**

```
┌─────────────────────────────────────────────────────────────┐
│                     FLUXO DE WEBHOOK                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Use Case cria OutboxEvent (PENDING)                     │
│     → "Algo precisa ser processado"                         │
│                                                             │
│  2. Worker lê OutboxEvent                                   │
│     → "Vou processar isso"                                  │
│                                                             │
│  3. Worker busca WebhookConfigs ativas da Store             │
│     → "Para onde eu envio?"                                 │
│                                                             │
│  4. Para cada config que aceita o evento:                   │
│     a. Cria WebhookLog (attempt=1)                          │
│     b. Envia HTTP POST para config.url                      │
│     c. Se sucesso: WebhookLog.delivered_at = now()          │
│     d. Se falha: WebhookLog.next_retry_at = now() + backoff │
│                                                             │
│  5. Worker marca OutboxEvent = PROCESSED                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Separação:                                                 │
│  - OutboxEvent = "o que precisa ser processado"             │
│  - WebhookLog = "histórico de tentativas de entrega"        │
│                                                             │
│  Benefícios:                                                │
│  - Um OutboxEvent pode gerar múltiplos WebhookLogs          │
│  - Retry independente por webhook config                    │
│  - Auditoria completa de entregas                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Jobs Assíncronos

| Job                | Frequência | Descrição                            |
| ------------------ | ---------- | ------------------------------------ |
| OutboxProcessor    | 1s         | Processa eventos pendentes           |
| PaymentExpiration  | 1min       | Marca pagamentos expirados           |
| PaymentRelease     | 5min       | Libera saldo (D+N)                   |
| IdempotencyCleanup | 1h         | Remove keys expiradas (>24h)         |
| OutboxCleanup      | 1h         | Remove eventos processados (>7 dias) |

---

## 8. Fluxos de Dados

### 8.1 Fluxo Completo

```
[CRIAÇÃO]
API → Valida → Transaction(Payment + OutboxEvent) → Retorna QR

[PAGAMENTO]
Simulado → Transaction(CONFIRMED + pending + OutboxEvent) → Worker webhook

[LIBERAÇÃO D+N]
Job → Transaction(RELEASED + available + OutboxEvent) → Worker webhook

[SAQUE]
Dashboard → Transaction(Withdrawal + available - OutboxEvent) → Worker Pix
```

### 8.2 Estorno com Saldo Negativo

```
Account: available=50, pending=0
Estorno de R$ 100:
  → available = 50 - 100 = -50 (negativo!)
  → Saque bloqueado

Próximo pagamento liberado (R$ 80):
  → available = -50 + 80 = 30
  → Transaction (NEGATIVE_COMPENSATED)
```

---

## 9. Índices e Performance

```sql
-- Outbox (mais crítico)
CREATE INDEX idx_outbox_pending
ON outbox_events(status, next_retry_at, created_at)
WHERE status = 'PENDING';

-- Expiração
CREATE INDEX idx_payments_expiration
ON payments(status, expires_at)
WHERE status = 'PENDING';

-- Liberação
CREATE INDEX idx_payments_release
ON payments(status, paid_at, released_at)
WHERE status = 'CONFIRMED' AND released_at IS NULL;

-- Extrato
CREATE INDEX idx_transactions_extrato
ON transactions(account_id, created_at DESC);
```

---

## Changelog

| Data    | Versão | Descrição                                                                                                                                                                                                                                                    |
| ------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2025-02 | 1.0    | Documento inicial                                                                                                                                                                                                                                            |
| 2025-02 | 2.0    | Correções: storeId removido do Withdrawal, WebhookLog relation, Account auto-create, CustomerId obrigatório, Outbox pattern, Jobs, Idempotency 24h                                                                                                           |
| 2026-02 | 3.0    | Correções e melhorias: Product documentado, PaymentItem documentado, expires_at documentado, query de liberação com JOIN, OutboxEvent sem FK explicado, configId obrigatório, fluxo Outbox→WebhookLog documentado, múltiplos webhooks documentado |

---

_Documento de modelagem de dados do Hockpay._
_Última atualização: Fevereiro/2026_
