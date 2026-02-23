# @hockpay/worker

Worker de processamento assíncrono do Hockpay. Responsável por webhooks, jobs agendados e processamento de outbox.

## Jobs

| Job | Frequência | Descrição |
|-----|------------|-----------|
| `PaymentExpirationJob` | A cada minuto | Expira pagamentos vencidos |
| `PaymentReleaseJob` | A cada minuto | Libera pagamentos confirmados (settlement) |
| `OutboxDispatcherJob` | A cada 5 segundos | Dispara eventos de outbox como webhooks |
| `CleanupLogsJob` | Diário | Remove logs antigos |
| `AntiFraudJob` | A cada hora | Detecta anomalias |
| `SettlementJob` | Diário | Processa liquidações |

## Fluxo do Worker

```
1. PaymentExpirationJob
   ├── Busca pagamentos PENDING com expiresAt < now
   └── Executa ExpirePaymentUseCase → cria OutboxEvent

2. OutboxDispatcherJob
   ├── Busca OutboxEvents com status PENDING
   ├── Envia webhook via HTTP POST
   └── Marca como PROCESSADO ou incrementa retry

3. PaymentReleaseJob
   ├── Busca pagamentos CONFIRMED prontos para liberação
   └── Executa ReleasePaymentUseCase
```

## Retry Strategy

| Tentativa | Delay |
|-----------|-------|
| 1 | Imediato |
| 2 | 1 minuto |
| 3 | 5 minutos |
| 4 | 30 minutos |
| 5 | 2 horas |

Após 5 tentativas falhas, o webhook é marcado como falho permanentemente.

## Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | Conexão PostgreSQL |
| `REDIS_URL` | Conexão Redis (BullMQ) |

## Scripts

```bash
pnpm dev          # Desenvolvimento (watch)
pnpm build        # Build de produção
pnpm start:prod   # Iniciar produção
pnpm test         # Testes unitários
```

## Dependências Internas

- `@hockpay/core` - Use cases e entidades
- `@hockpay/infrastructure` - Implementações de repositories
- `@hockpay/database` - Prisma client

---

[Voltar para README principal](../../README.md)
