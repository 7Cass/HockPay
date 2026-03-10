# Hockpay — Documento Técnico

> Plataforma de pagamentos Pix para devs indie e pequenas startups.
> "Aceite pagamentos no seu SaaS em 10 minutos."

---

## Índice

1. [Visão do Produto](#1-visão-do-produto)
2. [Personas e Casos de Uso](#2-personas-e-casos-de-uso)
3. [Arquitetura Geral](#3-arquitetura-geral)
4. [Estrutura do Monorepo](#4-estrutura-do-monorepo)
5. [Clean Architecture no Backend](#5-clean-architecture-no-backend)
6. [Modelagem de Dados](#6-modelagem-de-dados)
7. [Autenticação e Autorização](#7-autenticação-e-autorização)
8. [Fluxo do Pix Simulado](#8-fluxo-do-pix-simulado)
9. [Sistema de Webhooks](#9-sistema-de-webhooks)
10. [Idempotência](#10-idempotência)
11. [Dev Mode e Simulações](#11-dev-mode-e-simulações)
12. [Contratos da API](#12-contratos-da-api)
13. [Estratégia de Testes](#13-estratégia-de-testes)
14. [Infraestrutura Local](#14-infraestrutura-local)
15. [Observabilidade](#15-observabilidade)
16. [Roadmap de Implementação](#16-roadmap-de-implementação)

---

## 1. Visão do Produto

### 1.1 O que é o Hockpay

Hockpay é uma plataforma de pagamentos via Pix voltada para desenvolvedores independentes e pequenas startups. O objetivo é oferecer uma API simples, bem documentada, e um dashboard intuitivo para gerenciar transações.

**Importante:** O Hockpay não processa pagamentos reais. É um simulador com rigor técnico que replica o comportamento de um gateway de pagamento real (como Stripe, PagSeguro, Mercado Pago), incluindo:

- Geração de QR codes Pix
- Webhooks com retry e assinatura
- Idempotência em todas as operações
- Cenários de falha e edge cases

### 1.2 Por que esse projeto existe

1. **Portfólio:** Demonstrar domínio de conceitos críticos de fintech (idempotência, webhooks, consistência)
2. **Aprendizado:** Implementar AWS (SQS), Clean Architecture, e fluxos de pagamento
3. **Ecossistema:** Servir como base de pagamentos para os outros projetos do portfólio (Kōji, etc.)

### 1.3 O que NÃO é o Hockpay

- Não é um gateway de pagamento real
- Não processa dinheiro de verdade
- Não tem integração com bancos ou PSPs reais
- Não deve ser usado em produção com transações reais

---

## 2. Personas e Casos de Uso

### 2.1 Persona Principal: Dev Indie

**Nome:** Lucas, 28 anos  
**Perfil:** Desenvolvedor fullstack que criou um SaaS de gestão para freelancers  
**Contexto:** Precisa aceitar pagamentos de assinaturas mas não quer a burocracia de integrar com gateways grandes

**Dores:**
- Documentação confusa dos gateways existentes
- SDKs pesados e over-engineered
- Taxas altas para baixo volume
- Tempo de integração longo

**O que busca:**
- API REST simples e bem documentada
- Dashboard para acompanhar transações
- Webhooks confiáveis
- Integração em menos de 1 hora

### 2.2 Casos de Uso

| ID | Caso de Uso | Persona |
|----|-------------|---------|
| UC01 | Criar conta de merchant | Dev Indie |
| UC02 | Gerar API keys | Dev Indie |
| UC03 | Criar cobrança Pix | Dev Indie (via API) |
| UC04 | Visualizar QR code | Cliente final |
| UC05 | Simular pagamento | Dev Indie (dev mode) |
| UC06 | Receber webhook de confirmação | Dev Indie (servidor) |
| UC07 | Consultar transação | Dev Indie |
| UC08 | Listar transações no dashboard | Dev Indie |
| UC09 | Configurar webhook URL | Dev Indie |
| UC10 | Visualizar logs de webhook | Dev Indie |
| UC11 | Reenviar webhook manualmente | Dev Indie |

---

## 3. Arquitetura Geral

### 3.1 Visão de Alto Nível

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HOCKPAY PLATFORM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────────┐  │
│  │   Landing   │    │  Dashboard  │    │         Checkout Page           │  │
│  │   (Next.js) │    │  (Angular)  │    │           (Angular)             │  │
│  └──────┬──────┘    └──────┬──────┘    └───────────────┬─────────────────┘  │
│         │                  │                           │                    │
│  ═══════╪══════════════════╪═══════════════════════════╪════════════════    │
│         │                  │                           │                    │
│         ▼                  ▼                           ▼                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                           API Gateway (NestJS)                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │    Auth     │  │  Payments   │  │  Webhooks   │  │  Merchants  │  │   │
│  │  │   Module    │  │   Module    │  │   Module    │  │   Module    │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│         │                  │                 │                              │
│         ▼                  ▼                 ▼                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                      │
│  │ PostgreSQL  │    │    Redis    │    │   SQS/Bull  │                      │
│  │             │    │   (Cache)   │    │  (Queues)   │                      │
│  └─────────────┘    └─────────────┘    └──────┬──────┘                      │
│                                               │                             │
│                                               ▼                             │
│                                        ┌─────────────┐                      │
│                                        │   Worker    │                      │
│                                        │  (Webhooks) │                      │
│                                        └─────────────┘                      │
│                                               │                             │
│                                               ▼                             │
│                                        Merchant Server                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Componentes

| Componente | Tecnologia | Responsabilidade |
|------------|------------|------------------|
| Landing Page | Next.js | Marketing, pricing, documentação |
| Dashboard | Angular 18+ | Gestão de transações, configurações, API keys |
| Checkout Page | Next.js | Página de pagamento white-label |
| API | NestJS | Endpoints REST, regras de negócio |
| Worker | NestJS (aplicação separada) | Processamento de webhooks, jobs assíncronos |
| PostgreSQL | v15+ | Persistência de dados |
| Redis | v7+ | Cache, rate limiting, sessões |
| SQS (LocalStack) | AWS SQS | Fila de webhooks |

---

## 4. Estrutura do Monorepo

### 4.1 Visão Geral com Turborepo

```
hockpay/
├── apps/
│   ├── api/                    # NestJS - API principal
│   ├── worker/                 # NestJS - Worker de webhooks
│   ├── dashboard/              # Angular - Dashboard do merchant
│   ├── checkout/               # Next.js - Página de checkout
│   └── landing/                # Next.js - Landing page
│
├── packages/
│   ├── core/                   # Domain entities, use cases (shared)
│   ├── database/               # Prisma schema, migrations
│   ├── config/                 # Configurações compartilhadas
│   ├── dto/                    # DTOs compartilhados (API contracts)
│   ├── utils/                  # Utilitários compartilhados
│   ├── eslint-config/          # ESLint config base
│   ├── typescript-config/      # TSConfig base
│   └── ui/                     # Componentes Angular compartilhados
│
├── infrastructure/
│   ├── docker/
│   │   ├── docker-compose.yml
│   │   ├── docker-compose.localstack.yml
│   │   └── Dockerfiles/
│   └── scripts/
│
├── docs/
│   ├── api/                    # OpenAPI specs
│   ├── architecture/           # Diagramas e decisões
│   └── runbooks/               # Guias operacionais
│
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

### 4.2 Estrutura do apps/api

```
apps/api/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── guards/
│   │   │   └── strategies/
│   │   │
│   │   ├── merchants/
│   │   │   ├── merchants.module.ts
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   └── repositories/
│   │   │
│   │   ├── payments/
│   │   │   ├── payments.module.ts
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   └── repositories/
│   │   │
│   │   └── webhooks/
│   │       ├── webhooks.module.ts
│   │       ├── controllers/
│   │       ├── services/
│   │       └── repositories/
│   │
│   ├── infra/
│   │   ├── database/
│   │   ├── queue/
│   │   ├── cache/
│   │   └── http/
│   │
│   └── common/
│       ├── decorators/
│       ├── filters/
│       ├── interceptors/
│       ├── pipes/
│       └── guards/
│
├── test/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── nest-cli.json
├── tsconfig.json
└── package.json
```

### 4.3 Estrutura do packages/core (Clean Architecture)

```
packages/core/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── merchant.entity.ts
│   │   │   ├── payment.entity.ts
│   │   │   ├── webhook.entity.ts
│   │   │   └── api-key.entity.ts
│   │   │
│   │   ├── value-objects/
│   │   │   ├── money.vo.ts
│   │   │   ├── email.vo.ts
│   │   │   ├── pix-key.vo.ts
│   │   │   └── webhook-url.vo.ts
│   │   │
│   │   ├── events/
│   │   │   ├── payment-created.event.ts
│   │   │   ├── payment-confirmed.event.ts
│   │   │   └── payment-failed.event.ts
│   │   │
│   │   ├── errors/
│   │   │   ├── domain-error.ts
│   │   │   ├── payment-not-found.error.ts
│   │   │   └── invalid-status-transition.error.ts
│   │   │
│   │   └── repositories/
│   │       ├── merchant.repository.ts      # Interface
│   │       ├── payment.repository.ts       # Interface
│   │       └── webhook.repository.ts       # Interface
│   │
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── create-payment.use-case.ts
│   │   │   ├── confirm-payment.use-case.ts
│   │   │   ├── get-payment.use-case.ts
│   │   │   ├── create-merchant.use-case.ts
│   │   │   └── dispatch-webhook.use-case.ts
│   │   │
│   │   ├── services/
│   │   │   ├── idempotency.service.ts      # Interface
│   │   │   ├── qrcode.service.ts           # Interface
│   │   │   └── webhook-dispatcher.service.ts
│   │   │
│   │   └── ports/
│   │       ├── queue.port.ts
│   │       └── cache.port.ts
│   │
│   └── index.ts
│
├── package.json
└── tsconfig.json
```

### 4.4 Configuração do Turborepo

**turbo.json:**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", ".angular/**"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "test:e2e": {
      "dependsOn": ["^build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

**pnpm-workspace.yaml:**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

---

## 5. Clean Architecture no Backend

### 5.1 Camadas

```
┌─────────────────────────────────────────────────────────────────┐
│                        Presentation                             │
│                   (Controllers, Guards)                         │
├─────────────────────────────────────────────────────────────────┤
│                        Application                              │
│                 (Use Cases, App Services)                       │
├─────────────────────────────────────────────────────────────────┤
│                          Domain                                 │
│          (Entities, Value Objects, Domain Events)               │
├─────────────────────────────────────────────────────────────────┤
│                       Infrastructure                            │
│      (Repositories Impl, Queue Impl, External Services)         │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Regra de Dependência

- **Domain** não depende de nada externo
- **Application** depende apenas de Domain
- **Infrastructure** implementa interfaces definidas em Domain/Application
- **Presentation** orquestra e depende de Application

### 5.3 Exemplo: Payment Entity

```typescript
// packages/core/src/domain/entities/payment.entity.ts

import { randomUUID } from 'crypto';
import { Money } from '../value-objects/money.vo';
import { PaymentStatus } from '../enums/payment-status.enum';
import { InvalidStatusTransitionError } from '../errors/invalid-status-transition.error';
import { PaymentCreatedEvent } from '../events/payment-created.event';
import { PaymentConfirmedEvent } from '../events/payment-confirmed.event';

export interface PaymentProps {
  id?: string;
  merchantId: string;
  amount: Money;
  description?: string;
  externalId?: string;
  status?: PaymentStatus;
  pixQrCode?: string;
  pixCopyPaste?: string;
  expiresAt?: Date;
  paidAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Payment {
  private _id: string;
  private _merchantId: string;
  private _amount: Money;
  private _description?: string;
  private _externalId?: string;
  private _status: PaymentStatus;
  private _pixQrCode?: string;
  private _pixCopyPaste?: string;
  private _expiresAt: Date;
  private _paidAt?: Date;
  private _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: Array<any> = [];

  private constructor(props: PaymentProps) {
    this._id = props.id ?? randomUUID();
    this._merchantId = props.merchantId;
    this._amount = props.amount;
    this._description = props.description;
    this._externalId = props.externalId;
    this._status = props.status ?? PaymentStatus.PENDING;
    this._pixQrCode = props.pixQrCode;
    this._pixCopyPaste = props.pixCopyPaste;
    this._expiresAt = props.expiresAt ?? this.defaultExpiration();
    this._paidAt = props.paidAt;
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
  }

  static create(props: Omit<PaymentProps, 'id' | 'status'>): Payment {
    const payment = new Payment(props);
    payment.addDomainEvent(new PaymentCreatedEvent(payment));
    return payment;
  }

  static reconstitute(props: PaymentProps): Payment {
    return new Payment(props);
  }

  confirm(): void {
    if (this._status !== PaymentStatus.PENDING) {
      throw new InvalidStatusTransitionError(this._status, PaymentStatus.CONFIRMED);
    }
    this._status = PaymentStatus.CONFIRMED;
    this._paidAt = new Date();
    this._updatedAt = new Date();
    this.addDomainEvent(new PaymentConfirmedEvent(this));
  }

  expire(): void {
    if (this._status !== PaymentStatus.PENDING) {
      throw new InvalidStatusTransitionError(this._status, PaymentStatus.EXPIRED);
    }
    this._status = PaymentStatus.EXPIRED;
    this._updatedAt = new Date();
  }

  fail(reason: string): void {
    if (this._status !== PaymentStatus.PENDING) {
      throw new InvalidStatusTransitionError(this._status, PaymentStatus.FAILED);
    }
    this._status = PaymentStatus.FAILED;
    this._updatedAt = new Date();
  }

  isExpired(): boolean {
    return new Date() > this._expiresAt;
  }

  private defaultExpiration(): Date {
    const expiration = new Date();
    expiration.setMinutes(expiration.getMinutes() + 30);
    return expiration;
  }

  private addDomainEvent(event: any): void {
    this._domainEvents.push(event);
  }

  pullDomainEvents(): Array<any> {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  // Getters
  get id(): string { return this._id; }
  get merchantId(): string { return this._merchantId; }
  get amount(): Money { return this._amount; }
  get status(): PaymentStatus { return this._status; }
  get pixQrCode(): string | undefined { return this._pixQrCode; }
  get pixCopyPaste(): string | undefined { return this._pixCopyPaste; }
  get expiresAt(): Date { return this._expiresAt; }
  get paidAt(): Date | undefined { return this._paidAt; }

  setPixData(qrCode: string, copyPaste: string): void {
    this._pixQrCode = qrCode;
    this._pixCopyPaste = copyPaste;
    this._updatedAt = new Date();
  }
}
```

### 5.4 Exemplo: CreatePayment Use Case

```typescript
// packages/core/src/application/use-cases/create-payment.use-case.ts

import { Payment } from '../../domain/entities/payment.entity';
import { Money } from '../../domain/value-objects/money.vo';
import { PaymentRepository } from '../../domain/repositories/payment.repository';
import { QrCodeService } from '../services/qrcode.service';
import { IdempotencyService } from '../services/idempotency.service';
import { QueuePort } from '../ports/queue.port';

export interface CreatePaymentInput {
  merchantId: string;
  amount: number;
  currency: string;
  description?: string;
  externalId?: string;
  idempotencyKey: string;
}

export interface CreatePaymentOutput {
  id: string;
  status: string;
  amount: number;
  currency: string;
  pixQrCode: string;
  pixCopyPaste: string;
  expiresAt: Date;
  createdAt: Date;
}

export class CreatePaymentUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly qrCodeService: QrCodeService,
    private readonly idempotencyService: IdempotencyService,
    private readonly queue: QueuePort,
  ) {}

  async execute(input: CreatePaymentInput): Promise<CreatePaymentOutput> {
    // 1. Verificar idempotência
    const cached = await this.idempotencyService.get<CreatePaymentOutput>(
      input.idempotencyKey
    );
    if (cached) {
      return cached;
    }

    // 2. Criar entidade de pagamento
    const payment = Payment.create({
      merchantId: input.merchantId,
      amount: Money.create(input.amount, input.currency),
      description: input.description,
      externalId: input.externalId,
    });

    // 3. Gerar QR code Pix
    const pixData = await this.qrCodeService.generate({
      paymentId: payment.id,
      amount: payment.amount.value,
      merchantId: payment.merchantId,
    });
    payment.setPixData(pixData.qrCode, pixData.copyPaste);

    // 4. Persistir
    await this.paymentRepository.save(payment);

    // 5. Disparar eventos de domínio
    const events = payment.pullDomainEvents();
    for (const event of events) {
      await this.queue.publish('payment.events', event);
    }

    // 6. Montar output
    const output: CreatePaymentOutput = {
      id: payment.id,
      status: payment.status,
      amount: payment.amount.value,
      currency: payment.amount.currency,
      pixQrCode: payment.pixQrCode!,
      pixCopyPaste: payment.pixCopyPaste!,
      expiresAt: payment.expiresAt,
      createdAt: payment.createdAt,
    };

    // 7. Cachear para idempotência
    await this.idempotencyService.set(input.idempotencyKey, output);

    return output;
  }
}
```
## 6. Modelagem de Dados

### 6.1 Diagrama ER

```
┌──────────────────┐       ┌──────────────────┐       ┌────────────────┐
│    merchants     │       │    api_keys      │       │    payments    │
├──────────────────┤       ├──────────────────┤       ├────────────────┤
│ id (PK)          │──┐    │ id (PK)          │       │ id (PK)        │
│ email            │  │    │ merchant_id (FK) │──┐    │ merchant_id(FK)│
│ password_hash    │  │    │ key_hash         │  │    │ external_id    │
│ name             │  │    │ prefix           │  │    │ amount         │
│ document         │  └───▶│ name             │  │    │ currency       │
│ is_active        │       │ environment      │  │    │ description    │
│ created_at       │       │ last_used_at     │  │    │ status         │
│ updated_at       │       │ created_at       │  │    │ pix_qr_code    │
└──────────────────┘       │ revoked_at       │  │    │ pix_copy_paste │
        │                  └──────────────────┘  │    │ expires_at     │
        │                                        │    │ paid_at        │
        │    ┌──────────────────┐                │    │ created_at     │
        │    │ refresh_tokens   │                │    │ updated_at     │
        │    ├──────────────────┤                │    └───────┬────────┘
        └───▶│ id (PK)          │                │            │
             │ merchant_id (FK) │                │            │
             │ token_hash       │                │            │
             │ expires_at       │                │            │
             │ created_at       │                │            │
             │ revoked_at       │                │            │
             └──────────────────┘                │            │
                                                │            │
┌──────────────────┐       ┌────────────────────┴────────────┘
│ webhook_configs  │       │
├──────────────────┤       │       ┌──────────────────┐
│ id (PK)          │       │       │  webhook_logs    │
│ merchant_id (FK) │◄──────┘       ├──────────────────┤
│ url              │               │ id (PK)          │
│ secret           │               │ payment_id (FK)  │
│ events           │               │ config_id (FK)   │
│ is_active        │               │ event_type       │
│ created_at       │               │ payload          │
│ updated_at       │               │ response_status  │
└──────────────────┘               │ response_body    │
                                   │ attempt          │
┌──────────────────┐               │ next_retry_at    │
│idempotency_keys  │               │ delivered_at     │
├──────────────────┤               │ created_at       │
│ id (PK)          │               └──────────────────┘
│ key              │
│ merchant_id (FK) │
│ request_path     │
│ request_hash     │
│ response_body    │
│ response_status  │
│ created_at       │
│ expires_at       │
└──────────────────┘
```

### 6.2 Prisma Schema

```prisma
// packages/database/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Merchant {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String    @map("password_hash")
  name          String
  document      String?
  isActive      Boolean   @default(true) @map("is_active")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  apiKeys        ApiKey[]
  refreshTokens  RefreshToken[]
  payments       Payment[]
  webhookConfigs WebhookConfig[]
  idempotencyKeys IdempotencyKey[]

  @@map("merchants")
}

model ApiKey {
  id          String      @id @default(uuid())
  merchantId  String      @map("merchant_id")
  keyHash     String      @map("key_hash")
  prefix      String
  name        String
  environment Environment @default(TEST)
  lastUsedAt  DateTime?   @map("last_used_at")
  createdAt   DateTime    @default(now()) @map("created_at")
  revokedAt   DateTime?   @map("revoked_at")

  merchant    Merchant    @relation(fields: [merchantId], references: [id])

  @@index([prefix])
  @@index([merchantId])
  @@map("api_keys")
}

model RefreshToken {
  id          String    @id @default(uuid())
  merchantId  String    @map("merchant_id")
  tokenHash   String    @map("token_hash")
  expiresAt   DateTime  @map("expires_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  revokedAt   DateTime? @map("revoked_at")

  merchant    Merchant  @relation(fields: [merchantId], references: [id])

  @@index([tokenHash])
  @@index([merchantId])
  @@map("refresh_tokens")
}

model Payment {
  id            String        @id @default(uuid())
  merchantId    String        @map("merchant_id")
  externalId    String?       @map("external_id")
  amount        Int
  currency      String        @default("BRL")
  description   String?
  status        PaymentStatus @default(PENDING)
  pixQrCode     String?       @map("pix_qr_code")
  pixCopyPaste  String?       @map("pix_copy_paste")
  pixTxId       String?       @map("pix_tx_id")
  expiresAt     DateTime      @map("expires_at")
  paidAt        DateTime?     @map("paid_at")
  failedReason  String?       @map("failed_reason")
  metadata      Json?
  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt @map("updated_at")

  merchant      Merchant      @relation(fields: [merchantId], references: [id])
  webhookLogs   WebhookLog[]

  @@index([merchantId])
  @@index([externalId])
  @@index([status])
  @@map("payments")
}

enum PaymentStatus {
  PENDING
  CONFIRMED
  EXPIRED
  FAILED
  REFUNDED
}

enum Environment {
  TEST
  LIVE
}

model WebhookConfig {
  id          String   @id @default(uuid())
  merchantId  String   @map("merchant_id")
  url         String
  secret      String
  events      String[]
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  merchant    Merchant     @relation(fields: [merchantId], references: [id])
  webhookLogs WebhookLog[]

  @@index([merchantId])
  @@map("webhook_configs")
}

model WebhookLog {
  id             String    @id @default(uuid())
  paymentId      String    @map("payment_id")
  configId       String    @map("config_id")
  eventType      String    @map("event_type")
  payload        Json
  requestHeaders Json?     @map("request_headers")
  responseStatus Int?      @map("response_status")
  responseBody   String?   @map("response_body")
  attempt        Int       @default(1)
  maxAttempts    Int       @default(5) @map("max_attempts")
  nextRetryAt    DateTime? @map("next_retry_at")
  deliveredAt    DateTime? @map("delivered_at")
  createdAt      DateTime  @default(now()) @map("created_at")

  payment        Payment       @relation(fields: [paymentId], references: [id])
  config         WebhookConfig @relation(fields: [configId], references: [id])

  @@index([paymentId])
  @@index([nextRetryAt])
  @@map("webhook_logs")
}

model IdempotencyKey {
  id             String   @id @default(uuid())
  key            String
  merchantId     String   @map("merchant_id")
  requestPath    String   @map("request_path")
  requestHash    String   @map("request_hash")
  responseBody   Json     @map("response_body")
  responseStatus Int      @map("response_status")
  createdAt      DateTime @default(now()) @map("created_at")
  expiresAt      DateTime @map("expires_at")

  merchant       Merchant @relation(fields: [merchantId], references: [id])

  @@unique([key, merchantId])
  @@index([expiresAt])
  @@map("idempotency_keys")
}
```

---

## 7. Autenticação e Autorização

### 7.1 Dois Contextos de Auth

| Contexto | Método | Uso |
|----------|--------|-----|
| Dashboard | JWT + Refresh Token | Login do merchant |
| API Pública | API Keys | Chamadas de integração |

### 7.2 JWT + Refresh Token (Dashboard)

**Fluxo:**

```
1. POST /auth/login → JWT (15min) + Refresh Token (7 dias)
2. Requisições com: Authorization: Bearer {jwt}
3. JWT expira → POST /auth/refresh com cookie
4. Retorna novo par de tokens (rotation)
```

**Estrutura do JWT:**

```json
{
  "sub": "merchant_uuid",
  "email": "dev@example.com",
  "type": "access",
  "iat": 1699999999,
  "exp": 1700000899
}
```

### 7.3 API Keys

**Formato:**

```
hk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
│  │    └────────────────────────────────┘
│  │              32 chars random
│  └── environment (live/test)
└── prefix (hockpay)
```

**Armazenamento:** Apenas o hash SHA-256 é persistido. A key completa é mostrada apenas uma vez na criação.

**Uso:**

```http
POST /v1/payments
Authorization: Bearer hk_live_xxxxxxxxxxxxx
```

### 7.4 API Key Guard

```typescript
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer hk_')) {
      throw new UnauthorizedException('Invalid API key format');
    }

    const apiKey = authHeader.substring(7);
    const merchant = await this.apiKeyService.validate(apiKey);
    
    if (!merchant) {
      throw new UnauthorizedException('Invalid API key');
    }

    request.merchant = merchant;
    request.apiKeyEnvironment = apiKey.includes('_live_') ? 'live' : 'test';

    return true;
  }
}
```

---

## 8. Fluxo do Pix Simulado

### 8.1 Diagrama de Sequência

```
Merchant     Hockpay      Checkout     "Banco"
Server        API          Page       Simulado
   │            │            │            │
   │  1. POST   │            │            │
   │  /payments │            │            │
   │───────────▶│            │            │
   │            │            │            │
   │  2. QR +   │            │            │
   │  URL       │            │            │
   │◀───────────│            │            │
   │            │            │            │
   │            │ 3. Acessa  │            │
   │            │◀───────────│            │
   │            │            │            │
   │            │ 4. QR page │            │
   │            │───────────▶│            │
   │            │            │            │
   │            │            │ 5. "Paga"  │
   │            │            │───────────▶│
   │            │            │            │
   │            │ 6. Webhook │            │
   │            │◀───────────────────────│
   │            │            │            │
   │ 7. Webhook │            │            │
   │ confirmed  │            │            │
   │◀───────────│            │            │
   │            │            │            │
   │            │ 8. WS      │            │
   │            │ update     │            │
   │            │───────────▶│            │
```

### 8.2 Estados do Pagamento

```
              ┌─────────────┐
              │   PENDING   │
              └──────┬──────┘
                     │
     ┌───────────────┼───────────────┐
     │               │               │
     ▼               ▼               ▼
┌─────────┐   ┌─────────┐   ┌─────────┐
│CONFIRMED│   │ EXPIRED │   │ FAILED  │
└────┬────┘   └─────────┘   └─────────┘
     │
     ▼
┌─────────┐
│REFUNDED │
└─────────┘
```

**Transições válidas:**

| De | Para | Trigger |
|----|------|---------|
| PENDING | CONFIRMED | Webhook de confirmação |
| PENDING | EXPIRED | Job de expiração (30min) |
| PENDING | FAILED | Simulação de falha |
| CONFIRMED | REFUNDED | Requisição de estorno |

---

## 9. Sistema de Webhooks

### 9.1 Eventos Disponíveis

| Evento | Descrição |
|--------|-----------|
| `payment.created` | Pagamento criado |
| `payment.confirmed` | Pagamento confirmado |
| `payment.expired` | Pagamento expirado |
| `payment.failed` | Pagamento falhou |
| `payment.refunded` | Pagamento estornado |

### 9.2 Payload do Webhook

```json
{
  "id": "wh_a1b2c3d4e5f6",
  "type": "payment.confirmed",
  "createdAt": "2024-01-15T10:30:00Z",
  "data": {
    "object": {
      "id": "pay_x9y8z7w6",
      "externalId": "order_123",
      "amount": 1500,
      "currency": "BRL",
      "status": "confirmed",
      "paidAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

### 9.3 Headers de Assinatura

```http
Content-Type: application/json
X-Hockpay-Signature: sha256=a1b2c3d4e5f6...
X-Hockpay-Timestamp: 1705312200
X-Hockpay-Webhook-Id: wh_a1b2c3d4e5f6
```

### 9.4 Estratégia de Retry

| Attempt | Delay | Total Elapsed |
|---------|-------|---------------|
| 1 | Imediato | 0 |
| 2 | 1 min | 1 min |
| 3 | 5 min | 6 min |
| 4 | 30 min | 36 min |
| 5 | 2 horas | 2h 36min |

---

## 10. Idempotência

### 10.1 Por que Idempotência?

Evita cobranças duplicadas em caso de retry ou timeout.

```
SEM IDEMPOTÊNCIA:
Client ──POST──▶ API ──▶ Cria Payment 1
       (timeout)
Client ──POST──▶ API ──▶ Cria Payment 2 ❌ DUPLICADO

COM IDEMPOTÊNCIA:
Client ──POST──▶ API ──▶ Cria Payment 1
       (timeout)
Client ──POST──▶ API ──▶ Retorna Payment 1 ✅ MESMO
```

### 10.2 Uso

```http
POST /v1/payments
Idempotency-Key: unique-key-123
```

- Mesma key + mesmo body = retorna resposta cacheada
- Mesma key + body diferente = erro 409 Conflict
- Keys expiram em 24h

---

## 11. Dev Mode e Simulações

### 11.1 Cenários Simuláveis

| Cenário | Endpoint |
|---------|----------|
| Pagamento bem-sucedido | `POST /v1/dev/simulate/{id}/confirm` |
| Pagamento expirado | `POST /v1/dev/simulate/{id}/expire` |
| Falha genérica | `POST /v1/dev/simulate/{id}/fail` |
| Falha por saldo | `POST /v1/dev/simulate/{id}/fail?reason=insufficient_funds` |
| Demora na confirmação | `POST /v1/dev/simulate/{id}/confirm?delay=30` |

### 11.2 Restrição

Endpoints de simulação só funcionam com API keys de ambiente `test` (`hk_test_xxx`).

---

## 12. Contratos da API

### 12.1 Endpoints

```
BASE URL: https://api.hockpay.dev

AUTH
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout

DASHBOARD (JWT)
GET    /dashboard/me
PUT    /dashboard/me
GET    /dashboard/api-keys
POST   /dashboard/api-keys
DELETE /dashboard/api-keys/:id
GET    /dashboard/webhooks
PUT    /dashboard/webhooks
GET    /dashboard/payments
GET    /dashboard/payments/:id

API PÚBLICA (API Key)
POST   /v1/payments
GET    /v1/payments/:id
GET    /v1/payments

DEV MODE (API Key Test)
POST   /v1/dev/simulate/:id/confirm
POST   /v1/dev/simulate/:id/fail
POST   /v1/dev/simulate/:id/expire
```

### 12.2 Criar Pagamento

**Request:**

```http
POST /v1/payments
Authorization: Bearer hk_live_xxxxxxxxxxxxx
Idempotency-Key: unique-key-123
Content-Type: application/json

{
  "amount": 1500,
  "currency": "BRL",
  "description": "Assinatura Pro",
  "externalId": "order_12345",
  "expiresIn": 1800,
  "metadata": {
    "customerId": "cust_abc"
  }
}
```

**Response (201):**

```json
{
  "id": "pay_a1b2c3d4e5f6",
  "externalId": "order_12345",
  "amount": 1500,
  "currency": "BRL",
  "description": "Assinatura Pro",
  "status": "pending",
  "checkoutUrl": "https://checkout.hockpay.dev/pay_a1b2c3d4e5f6",
  "pix": {
    "qrCode": "data:image/png;base64,iVBORw0KGgo...",
    "copyPaste": "00020126580014br.gov.bcb.pix...",
    "txId": "HKPYLM7X8K9Q2W3E4R5T6Y7U"
  },
  "expiresAt": "2024-01-15T11:00:00Z",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### 12.3 Erros

```json
// 400 Bad Request
{
  "error": {
    "type": "validation_error",
    "message": "Invalid request body",
    "details": [{ "field": "amount", "message": "Must be positive" }]
  }
}

// 401 Unauthorized
{ "error": { "type": "authentication_error", "message": "Invalid API key" } }

// 404 Not Found
{ "error": { "type": "not_found_error", "message": "Payment not found" } }

// 409 Conflict
{ "error": { "type": "idempotency_error", "message": "Key already used" } }

// 429 Too Many Requests
{ "error": { "type": "rate_limit_error", "message": "Too many requests", "retryAfter": 60 } }
```
## 13. Estratégia de Testes

### 13.1 Pirâmide de Testes

```
            ┌───────────┐
            │    E2E    │  10%
            │   (API)   │
            ├───────────┤
            │Integration│  20%
            │ (Modules) │
       ┌────┴───────────┴────┐
       │      Unit Tests     │  70%
       │   (Core / Domain)   │
       └─────────────────────┘
```

### 13.2 Cobertura Mínima

| Camada | Cobertura | Foco |
|--------|-----------|------|
| Domain | 90% | Regras de negócio |
| Application | 85% | Fluxos |
| Infrastructure | 70% | Integrações |
| API (E2E) | 80% | Contratos |

### 13.3 Exemplo: Teste Unitário

```typescript
describe('Payment Entity', () => {
  it('should create with pending status', () => {
    const payment = Payment.create({
      merchantId: 'merchant_123',
      amount: Money.create(1500, 'BRL'),
    });

    expect(payment.status).toBe(PaymentStatus.PENDING);
  });

  it('should emit PaymentCreatedEvent on create', () => {
    const payment = Payment.create({
      merchantId: 'merchant_123',
      amount: Money.create(1500, 'BRL'),
    });

    const events = payment.pullDomainEvents();
    expect(events[0]).toBeInstanceOf(PaymentCreatedEvent);
  });

  it('should throw when confirming non-pending payment', () => {
    const payment = Payment.reconstitute({
      id: 'pay_123',
      merchantId: 'merchant_123',
      amount: Money.create(1500, 'BRL'),
      status: PaymentStatus.EXPIRED,
    });

    expect(() => payment.confirm()).toThrow(InvalidStatusTransitionError);
  });
});
```

### 13.4 Exemplo: Teste E2E

```typescript
describe('POST /v1/payments', () => {
  it('should create a payment', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/payments')
      .set('Authorization', `Bearer ${testApiKey}`)
      .set('Idempotency-Key', `test_${Date.now()}`)
      .send({ amount: 1500, currency: 'BRL' })
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.stringMatching(/^pay_/),
      status: 'pending',
      pix: { qrCode: expect.any(String) },
    });
  });

  it('should return same result for same idempotency key', async () => {
    const key = `test_${Date.now()}`;

    const r1 = await request(app.getHttpServer())
      .post('/v1/payments')
      .set('Authorization', `Bearer ${testApiKey}`)
      .set('Idempotency-Key', key)
      .send({ amount: 1500 });

    const r2 = await request(app.getHttpServer())
      .post('/v1/payments')
      .set('Authorization', `Bearer ${testApiKey}`)
      .set('Idempotency-Key', key)
      .send({ amount: 1500 });

    expect(r1.body.id).toBe(r2.body.id);
  });

  it('should reject different body with same key', async () => {
    const key = `test_${Date.now()}`;

    await request(app.getHttpServer())
      .post('/v1/payments')
      .set('Authorization', `Bearer ${testApiKey}`)
      .set('Idempotency-Key', key)
      .send({ amount: 1500 });

    await request(app.getHttpServer())
      .post('/v1/payments')
      .set('Authorization', `Bearer ${testApiKey}`)
      .set('Idempotency-Key', key)
      .send({ amount: 2000 })
      .expect(409);
  });
});
```

---

## 14. Infraestrutura Local

### 14.1 Docker Compose

```yaml
# infrastructure/docker/docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: hockpay-postgres
    environment:
      POSTGRES_USER: hockpay
      POSTGRES_PASSWORD: hockpay_dev
      POSTGRES_DB: hockpay
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hockpay"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: hockpay-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  localstack:
    image: localstack/localstack:latest
    container_name: hockpay-localstack
    environment:
      SERVICES: sqs
      DEFAULT_REGION: us-east-1
      AWS_ACCESS_KEY_ID: test
      AWS_SECRET_ACCESS_KEY: test
    ports:
      - "4566:4566"
    volumes:
      - ./localstack/init-aws.sh:/etc/localstack/init/ready.d/init-aws.sh

volumes:
  postgres_data:
  redis_data:
```

### 14.2 Script LocalStack

```bash
#!/bin/bash
# infrastructure/docker/localstack/init-aws.sh

awslocal sqs create-queue --queue-name hockpay-webhooks
awslocal sqs create-queue --queue-name hockpay-webhooks-dlq
awslocal sqs create-queue --queue-name hockpay-payment-events

echo "Queues created!"
awslocal sqs list-queues
```

### 14.3 Makefile

```makefile
.PHONY: setup dev build test clean

setup:
	pnpm install
	docker compose -f infrastructure/docker/docker-compose.yml up -d
	pnpm run db:generate
	pnpm run db:migrate

dev:
	docker compose -f infrastructure/docker/docker-compose.yml up -d
	pnpm run dev

build:
	pnpm run build

test:
	pnpm run test

test-e2e:
	docker compose -f infrastructure/docker/docker-compose.yml up -d
	pnpm run test:e2e

clean:
	docker compose -f infrastructure/docker/docker-compose.yml down -v
```

---

## 15. Observabilidade

### 15.1 Logs Estruturados (Pino)

```json
{
  "level": "info",
  "time": 1705312200000,
  "service": "hockpay-api",
  "requestId": "req_abc123",
  "merchantId": "merchant_xyz",
  "msg": "Payment created",
  "paymentId": "pay_123",
  "amount": 1500
}
```

### 15.2 Health Checks

```typescript
@Controller('health')
export class HealthController {
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory', 150 * 1024 * 1024),
    ]);
  }

  @Get('ready')
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('database'),
    ]);
  }

  @Get('live')
  liveness() {
    return { status: 'ok' };
  }
}
```

---

## 16. Roadmap de Implementação

### 16.1 Visão Geral (8-10 semanas)

```
Semana 1-2: Setup & Foundation
Semana 3-4: Core Domain & Payments
Semana 5-6: Webhooks & Dev Mode
Semana 7-8: Dashboard & Checkout
Semana 9-10: Polish & Documentation
```

### 16.2 Detalhamento

#### Semana 1-2: Setup & Foundation

- [x] Setup monorepo Turborepo
- [x] ESLint, Prettier, TypeScript
- [x] Docker Compose (PostgreSQL, Redis, LocalStack)
- [x] Prisma schema inicial
- [x] Estrutura NestJS básica
- [ ] Health check endpoint
- [ ] CI básico (lint + build)

**Entrega:** `pnpm dev` rodando, health check ok

#### Semana 3-4: Core Domain & Payments

- [ ] Entities: Payment, Merchant, ApiKey
- [ ] Value Objects: Money, Email
- [ ] Use Cases: CreatePayment, GetPayment
- [ ] Auth: JWT + Refresh + API Keys
- [ ] POST /v1/payments
- [ ] GET /v1/payments/:id
- [ ] Geração de QR Code Pix
- [ ] Testes unitários core (90%)

**Entrega:** Criar e consultar pagamentos via API

#### Semana 5-6: Webhooks & Dev Mode

- [ ] WebhookConfig, WebhookLog entities
- [ ] Worker para processar webhooks
- [ ] Retry com backoff exponencial
- [ ] Assinatura HMAC
- [ ] Endpoints de simulação
- [ ] Idempotência
- [ ] Testes E2E (80%)

**Entrega:** Webhooks funcionando com retry

#### Semana 7-8: Dashboard & Checkout

- [ ] Setup Angular
- [ ] Login/registro
- [ ] Listagem de pagamentos
- [ ] Detalhes do pagamento
- [ ] Configuração de webhooks
- [ ] API keys management
- [ ] Checkout page com QR
- [ ] WebSocket real-time

**Entrega:** Dashboard e Checkout funcionais

#### Semana 9-10: Polish & Documentation

- [ ] Landing page (Next.js)
- [ ] Documentação OpenAPI/Swagger
- [ ] README detalhado
- [ ] Documentação de arquitetura
- [ ] Deploy staging
- [ ] Bug fixes

**Entrega:** Produto completo e documentado

### 16.3 Milestones

| Milestone | Semana | Critério |
|-----------|--------|----------|
| M1: Foundation | 2 | Monorepo rodando |
| M2: Core API | 4 | Criar/consultar pagamentos |
| M3: Webhooks | 6 | Webhooks com retry |
| M4: Frontend | 8 | Dashboard + Checkout |
| M5: Release | 10 | Documentado e deployed |

---

## 17. Referências

### Documentação de Gateways

- [Stripe API](https://stripe.com/docs/api)
- [PagSeguro](https://dev.pagseguro.uol.com.br/)
- [Mercado Pago](https://www.mercadopago.com.br/developers)
- [Pix BCB](https://www.bcb.gov.br/estabilidadefinanceira/pix)

### Artigos Técnicos

- [Idempotency - Stripe](https://stripe.com/blog/idempotency)
- [Webhooks Guide](https://requestbin.com/blog/working-with-webhooks/)
- [Dead Letter Queues - Uber](https://eng.uber.com/reliable-reprocessing/)

### Livros

- Clean Architecture — Robert C. Martin
- Domain-Driven Design — Eric Evans
- Designing Data-Intensive Applications — Martin Kleppmann

---

## Changelog

| Data | Versão | Descrição |
|------|--------|-----------|
| 2025-02 | 1.0 | Documento inicial |

---

*Documento técnico para desenvolvimento do Hockpay.*
*Última atualização: Fevereiro/2025*
