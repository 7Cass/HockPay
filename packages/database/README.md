# 🗄️ `@hockpay/database`

[![Prisma](https://img.shields.io/badge/Prisma-6+-blue.svg)](https://www.prisma.io/)

Este pacote é a fonte única de verdade para a persistência de estado do Hockpay. Ele centraliza as credenciais de conexão, de modelagem de dados, esquemas relacionais, e *migrations* geridas exclusivamente pelo **Prisma ORM**.

Ao manter o banco de dados como um pacote separado da API, garantimos que qualquer outro serviço (como as rotinas isoladas no worker ou lambdas de relatórios) consiga referenciar o mesmo `schema.prisma` com typesafety completo, unificando a experiência de desenvolvimento no monorepo e aderindo aos princípios de Clean Architecture.

## 🗃️ Arquitetura de Dados Principal

O schema está configurado para consumir um **PostgreSQL 15+**. O cerne relacional gira em torno:

- `Merchant`: Logista autônomo (SaaS Owner).
- `Payment`: Mapeia um payload de pagamento de transação Pix com seus status rígidos (`PENDING`, `CONFIRMED`, `EXPIRED`, `FAILED`).
- `WebhookConfig` e `WebhookLog`: Lida com configurações URLs de notificador e logs de delivery com tentativas (`Outbox Pattern`).
- `ApiKey` e `IdempotencyKey`: Aspectos críticos de segurança para integradores.

*💡 Para verificação profunda do ER e diagramas, leia o [DATA_MODELING.md](../../DATA_MODELING.md) na raiz do projeto.*

## 💻 Comandos e CLI do Prisma

Os scripts a seguir devem ser rodados a partir **desta pasta (`packages/database`)**:

```bash
# Sincroniza o cliente do Prisma com o schema local
pnpm run db:generate

# Roda novas migrations contra a base configurada no .env
pnpm run db:migrate:dev

# Roda todas as automações pendentes de build/release
# (É o que usualmente se executa em CI/CD)
pnpm run db:migrate:deploy

# Sincroniza schema local com BD sem gerar arquivos de migration 
# (Ideal apensa para desenvolvimento prematuro exploratório)
pnpm run db:push

# Inicializa o Studio UI do Prisma na porta local (ótimo para debugging dos dados)
pnpm run db:studio

# Povoa o banco com o arquivo de Seed
pnpm run db:seed
```

## 🔌 Importação do Cliente

Os demais scripts do workspace (ex. `@hockpay/infrastructure`) nunca chamam o NPM global do `@prisma/client`, mas requerem este pacote sob a dependência:

```typescript
import { PrismaClient } from '@hockpay/database';
const prisma = new PrismaClient();
```

---

[⬅️ Voltar para o monorepo raiz](../../README.md)
