# `@hockpay/infrastructure`

Pacote de infraestrutura compartilhada do monorepo.

## Estado Atual

Hoje este pacote centraliza a infraestrutura compartilhada entre API e worker. Ele expõe principalmente:

- repositórios Prisma compartilhados
- `UnitOfWork`
- serviços criptográficos e HTTP compartilhados
- fila BullMQ de expiração de pagamento

## O que realmente está aqui

| Tipo                     | Exemplos atuais                                                                                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repositories             | `PaymentRepository`, `PixChargeRepository`, `PaymentLinkRepository`, `OutboxRepository`, `WebhookConfigRepository`, `WebhookLogRepository`, `WebhookInboxEventRepository`, `AlertConfigRepository`, `AlertDeliveryLogRepository`, `CheckoutSessionRepository`, `RefundRepository`, `ReceiptRepository`, `BankAccountRepository`, `WithdrawalRepository`, `StoreRepository`, `AccountRepository`, `TransactionRepository`, `CustomerRepository`, `IdempotencyKeyRepository`, `DashboardOverviewRepository` |
| Coordenação transacional | `UnitOfWork`                                                                                                                                                                           |
| Serviços utilitários     | `EncryptionService`, `HmacSignerService`, `WebhookHttpClientService`, `DiscordAlertSenderService`                                                                                      |
| Filas                    | `ExpirationQueue`                                                                                                                                                                      |

## O que não está consolidado aqui

- controllers, guards e módulos Nest das apps
- processors BullMQ e cron jobs do worker
- JWT, password hasher, QR code, slug/token generator e cache de idempotência
- geração de QR code

Parte relevante dessas implementações ainda vive dentro de `apps/api` e `apps/worker`.

## Objetivo do pacote no estado atual

Compartilhar implementações de persistência e transação entre API e worker sem acoplar o domínio ao Prisma.

## Scripts

```bash
pnpm build
pnpm dev
```

[Estado atual](../../docs/CURRENT_STATE.md) · [Voltar ao README raiz](../../README.md)
