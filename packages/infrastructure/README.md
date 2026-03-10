# 🗄️ `@hockpay/infrastructure`

Neste pacote residem todas as **implementações concretas** de integrações com o mundo externo (banco de dados, mensageria, serviços de terceiros), respeitando estritamente os contratos (interfaces) definidos em `@hockpay/core`.

Ao invólucro do **Clean Architecture**, o projeto garante que se amanhã o Prisma ORM for substituído por TypeORM, ou se AWS SQS for trocado por RabbitMQ, as lógicas de negócio no `core` permanecerão completamente intactas. A mudança será um detalhe restrito apenas a esta camada conceitual.

## 🏗️ O que este pacote faz?

Diferente de `apps/api` (que define as rotas HTTP), o pacote `infrastructure` provê as classes que operam sob responsabilidades únicas como:

- **Repositories**: Adaptações diretas sobre o `@hockpay/database` (PrismaClient). Exemplo: `PrismaPaymentRepository` atuando sobre a interface `PaymentRepository` do domínio.
- **Cache Providers**: Implementação de interfaces de porta para conversar com sistemas em-memória (como Redis) para controle do Idempotency Key.
- **Queue Injectors / Dispatchers**: Envio de cargas assíncronas para as filas de worker (para englobar o disparo dos Webhooks).
- **Serviços Criptográficos**: Geração de chaves Hash-SHA256, Bcrypt, QR Code Generators.

## 🔀 Ecossistema das Dependências

Para desempenhar suas funções, este módulo atua como uma **Ponte**, conectando ativamente:
- ➡️ `@hockpay/database`: De onde puxa o contexto de DB e modelagem do ORM.
- ⬅️ `@hockpay/core`: De onde extrai as Interfaces (Ports e Repositories) para que o Typescript valide a implementação.

## 💻 Comandos Locais

```bash
# Compila ativamente os arquivos .ts para cjs usando TSUp
pnpm build

# Roda o pacote no modo relacional de observação (dev)
pnpm dev
```

---

[⬅️ Voltar para o monorepo raiz](../../README.md)
