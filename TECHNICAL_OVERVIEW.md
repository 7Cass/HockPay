# Hockpay — Visão Técnica

Este documento separa explicitamente:

- `Implementado`: comportamento verificável no repositório atual
- `Parcial`: algo presente em parte do stack, mas não completo de ponta a ponta
- `Planejado`: direção alvo ainda não implementada

## 1. Implementação Atual

### 1.1 Topologia atual

| Área | Status | Observações |
|------|--------|-------------|
| `apps/api` | Implementado | API NestJS com prefixo `/api` e versão padrão `v1` |
| `apps/worker` | Implementado | Worker NestJS separado com BullMQ e cron jobs |
| `apps/web` | Implementado | App Angular único cobrindo landing, auth e dashboard |
| `apps/checkout` | Implementado | Checkout Next.js baseado em `checkout session token` |
| `apps/demo-mediakit` | Implementado | Demo de integração usando checkout hospedado e webhook |
| `packages/core` | Implementado | Domínio, portas, interfaces e use cases compartilhados |
| `packages/database` | Implementado | Schema Prisma, migrations e cliente |
| `packages/infrastructure` | Parcial | Repositórios compartilhados e `UnitOfWork`; parte da infra ainda vive nos apps |

### 1.2 Fluxo backend atual

1. A API recebe requisições em `/api/v1/...`.
2. A autenticação pode ocorrer via cookie JWT do dashboard ou API key (`CombinedAuthGuard`).
3. `CreatePaymentUseCase` valida store, cria ou reutiliza customer, calcula taxas, gera payload Pix, salva `Payment`, grava `OutboxEvent` e agenda expiração.
4. O worker roda `OutboxDispatcherJob`, busca eventos pendentes no outbox e os empilha em BullMQ.
5. `WebhookProcessor` consome a fila e chama `ProcessWebhookUseCase`, que cria `WebhookLog`, assina e entrega o webhook.
6. Jobs separados cuidam de expiração, liberação de pagamentos, limpeza de logs e varredura antifraude.

### 1.3 Infraestrutura atual

| Componente | Status | Implementação atual |
|------------|--------|---------------------|
| Banco | Implementado | PostgreSQL 15 local via Docker Compose |
| Cache | Implementado | Redis 7 |
| Fila | Implementado | BullMQ sobre Redis |
| SQS / LocalStack | Não implementado | Não há configuração ativa no repositório |

### 1.4 Frontends atuais

#### `apps/web`

- Landing pública em `features/landing`
- Auth em `features/auth`
- Dashboard em `features/dashboard`
- Há rotas visíveis para `products`, `financials` e `settings`, mas nem todas têm backend correspondente completo

#### `apps/checkout`

- Usa App Router
- Busca `checkout session` por token
- Faz `fulfill` da sessão para criar/submeter pagamento
- Usa endpoint público separado de simulação (`/payments/:id/simulate/:action`) para a UI de desenvolvimento do checkout

### 1.5 Padrões atuais relevantes

| Tema | Estado atual |
|------|--------------|
| Clean Architecture | Parcialmente implementada com boa separação entre `core`, `database`, `infrastructure` e apps |
| Idempotência | Implementada para criação de pagamentos; não é aplicada uniformemente a toda mutação |
| Webhooks | Implementados com HMAC, logs e outbox |
| Checkout session | Implementada de ponta a ponta |
| Product catalog | Parcial: existe no schema e há placeholder no dashboard, mas sem slice completo no backend |
| Refunds | Implementadas como estornos parciais ou totais, não apenas totais |

## 2. Principais Gaps do Estado Atual

### 2.1 Drift entre schema e runtime

- `Product` e `PaymentItem` existem no Prisma, mas não possuem cobertura equivalente em `core` + `api`
- `Account` é opcional na modelagem runtime atual; a criação automática na criação de store não está implementada no use case atual

### 2.2 Drift entre documentação histórica e código

- Documentação antiga falava em `dashboard` e `landing` como apps separados; hoje existe `apps/web`
- Documentação antiga falava em SQS/LocalStack; hoje o runtime usa BullMQ/Redis
- Documentação antiga tratava `/v1/...` como path raiz; hoje a API é `/api/v1/...`

### 2.3 Parcialidades atuais do frontend

- Página de produtos no Angular é placeholder visual
- Algumas telas de dashboard existem antes de a respectiva capacidade backend estar consolidada

## 3. Arquitetura Alvo

### 3.1 Objetivo de arquitetura

O alvo continua sendo uma plataforma Dev-First de pagamentos simulados com:

- backend centrado em domínio e casos de uso
- entrega assíncrona confiável de webhooks
- checkout hospedado separado do dashboard
- dashboards e fluxos de integração simples para merchants

### 3.2 Alvos estruturais

| Tema | Estado alvo |
|------|-------------|
| Documentação | Current-state e target-state claramente separados |
| Backend | Reduzir infra duplicada entre apps e consolidar adaptadores compartilhados |
| Dados | Alinhar schema, domínio e API para entities já presentes no Prisma |
| Frontend | Completar ou esconder áreas placeholder como `products` até que backend exista |
| Idempotência | Tornar a política explícita e coerente para mutações críticas |
| Arquitetura alvo antiga | Manter apenas o que ainda fizer sentido como direção real |

### 3.3 Alvos funcionais plausíveis

- consolidar o fluxo de catálogo/produtos para refletir `Product` e `PaymentItem`
- reduzir divergência entre `TECH_SPEC`, `DATA_MODELING` e implementação real
- deixar o outbox/webhook pipeline como contrato estável e bem documentado

## 4. Deltas Entre Atual e Alvo

| Tema | Atual | Alvo |
|------|-------|------|
| Topologia frontend | `apps/web` unifica landing + dashboard | manter unificado ou separar só se isso voltar a ser uma decisão real |
| Queue backend | BullMQ/Redis | BullMQ/Redis continua sendo o baseline documentado atual; outra fila só entra como alvo explícito |
| Products | schema + UI placeholder | cobertura real end-to-end ou remoção do placeholder |
| Docs | misturavam presente e futuro | separação formal entre implementado e planejado |
| Store/account | sem auto-criação explícita de account no use case | alinhar código e docs para um único comportamento |

## 5. Leitura Recomendada

- Para operação e onboarding: [README.md](./README.md)
- Para verdade atual do runtime: [docs/CURRENT_STATE_AUDIT.md](./docs/CURRENT_STATE_AUDIT.md)
- Para dados: [DATA_MODELING.md](./DATA_MODELING.md)
- Para arquitetura alvo: [docs/TECH_SPEC.md](./docs/TECH_SPEC.md)
