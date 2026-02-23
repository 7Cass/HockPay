# Hockpay

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9+-blue.svg)](https://pnpm.io/)

Plataforma de pagamentos Pix **simulada** para desenvolvedores independentes e pequenas startups.

> **Aviso:** Este é um simulador com rigor técnico. Nunca processe dinheiro real.

## Quick Start

```bash
# 1. Instalar dependências
pnpm install

# 2. Subir serviços (PostgreSQL, Redis)
docker compose -f infrastructure/docker/docker-compose.yml up -d

# 3. Configurar banco de dados
pnpm run db:generate && pnpm run db:migrate

# 4. Rodar todos os serviços
pnpm run dev
```

## O que é

- **Simulador de Pix** - Réplica de gateways como Stripe, PagSeguro, Mercado Pago
- **Projeto de portfólio** - Demonstra Clean Architecture, DDD e boas práticas
- **Zero dinheiro real** - Todas as transações são simuladas

## Arquitetura

```
hockpay/
├── apps/
│   ├── api/           # NestJS - API REST principal (porta 3000)
│   ├── worker/        # NestJS - Worker de webhooks e jobs
│   ├── dashboard/     # Angular - Dashboard do merchant
│   ├── checkout/      # Angular - Página de checkout
│   └── landing/       # Next.js - Landing page
│
└── packages/
    ├── core/          # Domain + Application (Clean Architecture)
    ├── database/      # Prisma schema + migrations
    ├── infrastructure/# Implementações de repositories
    ├── config/        # Configurações compartilhadas
    ├── dto/           # DTOs (API contracts)
    └── ui/            # Componentes Angular
```

## Exemplo de Uso

```bash
# Criar pagamento
curl -X POST http://localhost:3000/v1/payments \
  -H "Authorization: Bearer hk_test_xxx" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: pedido-123" \
  -d '{
    "amount": 1500,
    "customer": {
      "name": "João Silva",
      "email": "joao@email.com",
      "document": "12345678900"
    }
  }'

# Simular confirmação (dev mode)
curl -X POST http://localhost:3000/v1/dev/simulate/{payment_id}/confirm \
  -H "Authorization: Bearer hk_test_xxx"
```

## Comandos

| Comando | Descrição |
|---------|-----------|
| `pnpm run dev` | Roda todos os serviços |
| `pnpm run build` | Build de produção |
| `pnpm run test` | Testes unitários |
| `pnpm run test:e2e` | Testes E2E |
| `pnpm run lint` | Lint |
| `pnpm run db:studio` | Prisma Studio |

## Documentação

- [TECHNICAL_OVERVIEW.md](./TECHNICAL_OVERVIEW.md) - Documentação técnica completa
- [DATA_MODELING.md](./DATA_MODELING.md) - Modelagem de dados
- [CLAUDE.md](./CLAUDE.md) - Instruções para desenvolvedores

## Stack

- **Backend:** NestJS, Prisma, PostgreSQL, Redis, BullMQ
- **Frontend:** Angular, Next.js
- **Build:** Turborepo, pnpm, TypeScript

## Licença

MIT
