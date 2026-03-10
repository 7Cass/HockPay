# Hockpay

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9+-blue.svg)](https://pnpm.io/)

Plataforma de pagamentos Pix **simulada** para desenvolvedores independentes e pequenas startups. O objetivo é servir como um gateway de pagamento de fácil integração para testes e onboarding.

> **Importante:** Este é um simulador com rigor técnico. Nunca processe dinheiro real através dele.

## 🚀 Quick Start

```bash
# 1. Instalar dependências
pnpm install

# 2. Subir serviços (PostgreSQL 15, Redis 7)
docker compose -f infrastructure/docker/docker-compose.yml up -d

# 3. Configurar banco de dados (Prisma)
pnpm run db:generate
pnpm run db:migrate

# 4. Rodar todos os serviços
pnpm run dev
```

## 🏗️ Arquitetura do Monorepo

O projeto utiliza **Turborepo** para gerenciar as aplicações e bibliotecas compartilhadas, promovendo uma **Clean Architecture** e forte divisão de responsabilidades.

| Diretório | Descrição | Stack |
|-----------|-----------|-------|
| [`apps/api`](./apps/api) | API REST principal, gerenciamento de pagamentos, merchants e webhooks. | NestJS |
| [`apps/worker`](./apps/worker) | Worker para processos assíncronos (cron jobs e envio de webhooks via fila). | NestJS |
| [`apps/web`](./apps/web) | Aplicação web para Landing Page e Dashboard do merchant. | Angular |
| [`apps/checkout`](./apps/checkout) | Página de checkout white-label isolada para pagamentos. | Next.js |
| [`packages/core`](./packages/core) | Lógica de Domínio (Entidades e Value Objects) e Casos de Uso (Application). | TypeScript |
| [`packages/database`](./packages/database) | Configurações do Prisma ORM e Migrations. | Prisma |
| [`packages/infrastructure`](./packages/infrastructure)| Implementações concretas de Repositórios e Serviços (Redis, SQS, etc.). | TypeScript |

## 🕹️ Exemplo Rápido de Uso

```bash
# Criar um pagamento como merchant
curl -X POST http://localhost:3000/v1/payments \
  -H "Authorization: Bearer hk_test_sua_api_key_aqui" \
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

# Simular a confirmação do pagamento (Dev Mode)
curl -X POST http://localhost:3000/v1/dev/simulate/{payment_id}/confirm \
  -H "Authorization: Bearer hk_test_sua_api_key_aqui"
```

## 🛠️ Comandos Principais

| Comando | Descrição |
|---------|-----------|
| `pnpm run dev` | Roda todos os serviços em modo desenvolvimento. |
| `pnpm run build` | Faz build de produção de todos os pacotes. |
| `pnpm run test` | Roda testes unitários. |
| `pnpm run test:e2e` | Roda testes E2E. |
| `pnpm run lint` | Checa padronização de código. |
| `pnpm run format` | Formata o código com Prettier. |
| `pnpm run db:studio` | Abre o Prisma Studio para visualizar dados. |

## 📚 Documentações Auxiliares

Além dos `README.md` específicos de cada app/package, consulte:
- [**Visão Geral Técnica (TECHNICAL_OVERVIEW.md)**](./TECHNICAL_OVERVIEW.md): Arquitetura completa e diagramas.
- [**Modelagem de Dados (DATA_MODELING.md)**](./DATA_MODELING.md): Esquemas conceituais.
- [**Guia de Agentes de IA (CLAUDE.md)**](./CLAUDE.md): Instruções locais de desenvolvimento.

## 📄 Licença

MIT
