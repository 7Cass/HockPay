# `@hockpay/worker`

Worker NestJS separado para processamento assíncrono e tarefas agendadas.

## Estado Atual

- Framework: NestJS 11
- Porta padrão: `3001`
- Filas: BullMQ sobre Redis
- Cron jobs usam lock distribuído em Redis e mantêm guard in-process para evitar sobreposição dentro do mesmo worker
- Papel principal:
  - despachar eventos do outbox para a fila
  - processar entrega de webhooks
  - rodar cron jobs de manutenção e liquidação simulada

> Embora não seja uma API pública de negócio, o processo atual sobe um listener HTTP por meio do bootstrap padrão do Nest.

## Filas Atuais

| Fila | Uso |
|------|-----|
| `webhook-delivery` | entrega de webhooks |
| `payment-expiration` | agendamento/processamento de expiração |
| `alert-delivery` | entrega de alertas operacionais |
| `webhook-dead-letter` | falhas finais de `webhook-delivery` |
| `alert-dead-letter` | falhas finais de `alert-delivery` |

## Jobs Atuais

| Job | Variável | Default | Função |
|-----|----------|---------|--------|
| `OutboxDispatcherJob` | `WORKER_CRON_OUTBOX_DISPATCHER` | `*/10 * * * * *` | lê `OutboxEvent` pendente e empilha no BullMQ |
| `PaymentExpirationJob` | `WORKER_CRON_PAYMENT_EXPIRATION` | `* * * * *` | expira pagamentos pendentes vencidos |
| `SettlementJob` | `WORKER_CRON_SETTLEMENT` | `0 0 * * *` | libera pagamentos confirmados conforme `settlementDays` |
| `CleanupLogsJob` | `WORKER_CRON_CLEANUP_LOGS` | `0 3 * * *` | remove logs antigos e eventos processados |
| `CleanupIdempotencyKeysJob` | `WORKER_CRON_CLEANUP_IDEMPOTENCY_KEYS` | `0 4 * * *` | remove chaves expiradas |
| `AntiFraudJob` | `WORKER_CRON_ANTI_FRAUD` | `0 * * * *` | varredura simulada de anomalias |

Os agendamentos aceitam expressoes cron de 5 campos ou 6 campos. Use 6 campos para testes com segundos, por exemplo:

```env
WORKER_CRON_SETTLEMENT=*/30 * * * * *
WORKER_CRON_PAYMENT_EXPIRATION=*/10 * * * * *
```

## Fluxo Atual de Webhooks

1. A API cria um `Payment`.
2. Na mesma operação, grava um `OutboxEvent`.
3. `OutboxDispatcherJob` busca eventos pendentes do outbox.
4. O job envia o evento para BullMQ e só então marca o outbox como `DISPATCHED`.
5. `WebhookProcessor` consome a fila.
6. `ProcessWebhookUseCase`:
   - resolve configs ativas
   - monta payload envelope
   - assina com HMAC
   - cria `WebhookLog`
   - entrega via HTTP
7. Se BullMQ esgotar as tentativas, o worker grava um job em `webhook-dead-letter`.

`AlertProcessor` segue o mesmo padrão para `alert-delivery` e grava falhas finais em `alert-dead-letter`.

Cada job de DLQ contém:

- `originalQueue`
- `originalJobId`
- `originalJobName`
- `payload`
- `attemptsMade`
- `failedReason`
- `requestId`, quando existir
- `outboxEventId`, quando existir
- `timestamp`

## Contrato Atual de Assinatura

Headers relevantes atualmente enviados ao merchant:

- `X-Hockpay-Signature`
- `X-Hockpay-Timestamp`
- `X-Hockpay-Webhook-Id`
- `X-Request-ID`

## Variáveis de Ambiente Relevantes

| Variável | Uso |
|----------|-----|
| `PORT` | Porta do processo Nest |
| `DATABASE_URL` | PostgreSQL |
| `REDIS_HOST` / `REDIS_PORT` | conexão BullMQ/Redis |
| `ENCRYPTION_KEY` | descriptografia de segredos de webhook |
| `WORKER_CRON_*` | agendamento dos jobs periodicos do worker |
| `WORKER_CRON_LOCK_TTL_MS` | TTL do lock distribuído dos cron jobs, default `300000` |

## Observações

- O worker atual usa Redis/BullMQ; SQS/LocalStack não fazem parte do runtime atual.
- A documentação antiga dizia que o outbox partia de `WebhookLog`; isso não é mais verdade no código atual.
- O lock distribuído usa `SET NX PX` com token por aquisição e release protegido por comparação do token em Lua.
- O guard in-process continua ativo dentro de cada job para evitar sobreposição local mesmo com o lock distribuído.

## Scripts

```bash
pnpm dev
pnpm build
pnpm test
pnpm start:prod
```

### DLQ

Inspecione e refile jobs de dead letter:

```bash
pnpm dlq list webhook --limit 20
pnpm dlq show webhook <dlqJobId>
pnpm dlq requeue webhook <dlqJobId> --remove
pnpm dlq list alert
```

[Voltar ao README raiz](../../README.md)
