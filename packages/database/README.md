# @hockpay/database

Infrastructure Layer para acesso ao banco de dados usando Prisma.

## Estrutura

```
├── prisma/
│   ├── schema.prisma     # Schema do banco
│   └── migrations/       # Migrations geradas
│
└── src/
    └── prisma.service.ts # Serviço NestJS para Prisma
```

## Dependências

- `@prisma/client` - Prisma Client gerado
- `@nestjs/common` - Para PrismaService (Injectable)

## Scripts

```bash
pnpm db:generate         # Gera Prisma Client
pnpm db:migrate:dev      # Cria e roda migration (dev)
pnpm db:migrate:deploy   # Deploya migrations (prod)
pnpm db:push             # Push schema (sem migration)
pnpm db:studio           # Abre Prisma Studio
```

## Uso

```typescript
import { PrismaService } from '@hockpay/database';

@Module({
  providers: [PrismaService],
})
export class AppModule {}
```

## Sobre o Prisma em apps/api

O Prisma foi movido de `apps/api` para este package `database` para:

1. **Compartilhar** o schema entre `apps/api` e `apps/worker`
2. **Reutilizar** o PrismaService em múltiplos apps
3. **Centralizar** migrations
