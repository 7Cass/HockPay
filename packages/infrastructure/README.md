# `@hockpay/infrastructure`

Pacote de infraestrutura compartilhada do monorepo.

## Estado Atual

Hoje este pacote não centraliza toda a infraestrutura do sistema. Ele expõe principalmente:

- repositórios Prisma compartilhados
- `UnitOfWork`
- `EncryptionService`

## O que realmente está aqui

| Tipo | Exemplos atuais |
|------|-----------------|
| Repositories | `PaymentRepository`, `OutboxRepository`, `WebhookConfigRepository`, `WebhookLogRepository`, `CheckoutSessionRepository`, `RefundRepository`, `StoreRepository` |
| Coordenação transacional | `UnitOfWork` |
| Serviço utilitário | `EncryptionService` |

## O que não está consolidado aqui

- toda a camada HTTP
- toda a infraestrutura de BullMQ
- todos os serviços de HMAC/JWT/cache
- geração de QR code

Parte relevante dessas implementações ainda vive dentro de `apps/api` e `apps/worker`.

## Objetivo do pacote no estado atual

Compartilhar implementações de persistência e transação entre API e worker sem acoplar o domínio ao Prisma.

## Scripts

```bash
pnpm build
pnpm dev
```

[Voltar ao README raiz](../../README.md)
