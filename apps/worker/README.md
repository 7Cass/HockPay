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
  - processar saques simulados de forma assíncrona

> Embora não seja uma API pública de negócio, o processo atual sobe um listener HTTP por meio do bootstrap padrão do Nest.

## Filas Atuais

| Fila                  | Uso                                    |
| --------------------- | -------------------------------------- |
| `webhook-delivery`    | entrega de webhooks                    |
| `payment-expiration`  | agendamento/processamento de expiração |
| `alert-delivery`      | entrega de alertas operacionais        |
| `webhook-dead-letter` | falhas finais de `webhook-delivery`    |
| `alert-dead-letter`   | falhas finais de `alert-delivery`      |

## Jobs Atuais

| Job                         | Variável                               | Default          | Função                                                           |
| --------------------------- | -------------------------------------- | ---------------- | ---------------------------------------------------------------- |
| `OutboxDispatcherJob`       | `WORKER_CRON_OUTBOX_DISPATCHER`        | `*/10 * * * * *` | lê `OutboxEvent` pendente e empilha no BullMQ                    |
| `PaymentExpirationJob`      | `WORKER_CRON_PAYMENT_EXPIRATION`       | `* * * * *`      | expira pagamentos pendentes vencidos                             |
| `SettlementJob`             | `WORKER_CRON_SETTLEMENT`               | `0 0 * * *`      | libera pagamentos confirmados conforme `settlementDays`          |
| `WithdrawalProcessingJob`   | `WORKER_CRON_WITHDRAWAL_PROCESSING`    | `*/15 * * * * *` | processa saques pendentes com sucesso automático e retry técnico |
| `CleanupLogsJob`            | `WORKER_CRON_CLEANUP_LOGS`             | `0 3 * * *`      | remove logs antigos e eventos processados                        |
| `CleanupIdempotencyKeysJob` | `WORKER_CRON_CLEANUP_IDEMPOTENCY_KEYS` | `0 4 * * *`      | remove chaves expiradas                                          |
| `AntiFraudJob`              | `WORKER_CRON_ANTI_FRAUD`               | `0 * * * *`      | varredura simulada de anomalias                                  |

Os agendamentos aceitam expressoes cron de 5 campos ou 6 campos. Use 6 campos para testes com segundos, por exemplo:

```env
WORKER_CRON_SETTLEMENT=*/30 * * * * *
WORKER_CRON_PAYMENT_EXPIRATION=*/10 * * * * *
WORKER_CRON_WITHDRAWAL_PROCESSING=*/15 * * * * *
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

| Variável | Uso | Default local |
| --- | --- | --- |
| `PORT` | Porta do processo Nest | `3001` |
| `DATABASE_URL` | PostgreSQL compartilhado com a API | obrigatório |
| `REDIS_HOST` / `REDIS_PORT` | Redis de BullMQ, locks distribuídos e jobs | `localhost` / `6379` |
| `ENCRYPTION_KEY` | Descriptografia de segredos de webhook, precisa ser a mesma da API | obrigatório |
| `WORKER_CRON_OUTBOX_DISPATCHER` | Agendamento do dispatcher de outbox | `*/10 * * * * *` |
| `WORKER_CRON_PAYMENT_EXPIRATION` | Agendamento de expiração de pagamentos | `* * * * *` |
| `WORKER_CRON_SETTLEMENT` | Agendamento de settlement simulado | `0 0 * * *` |
| `WORKER_CRON_WITHDRAWAL_PROCESSING` | Agendamento de processamento de saques | `*/15 * * * * *` |
| `WORKER_CRON_CLEANUP_LOGS` | Agendamento de limpeza de logs | `0 3 * * *` |
| `WORKER_CRON_CLEANUP_IDEMPOTENCY_KEYS` | Agendamento de limpeza de chaves idempotentes | `0 4 * * *` |
| `WORKER_CRON_ANTI_FRAUD` | Agendamento da varredura antifraude simulada | `0 * * * *` |
| `WORKER_CRON_LOCK_TTL_MS` | TTL do lock distribuído dos cron jobs | `300000` |
| `WITHDRAWAL_SIMULATOR_FORCE_FAILURE` | Quando `true`, força falha técnica do processador de saques para testar retry/falha final | `false` |

O worker não lê `REDIS_URL`. Configure `REDIS_HOST` e `REDIS_PORT` para o mesmo Redis usado pela API em BullMQ/throttling. `DATABASE_URL` e `ENCRYPTION_KEY` também precisam ser compartilhados com a API para ler outbox, logs e segredos criptografados corretamente.

## Observações

- O worker atual usa Redis/BullMQ como backend de filas do runtime.
- A documentação antiga dizia que o outbox partia de `WebhookLog`; isso não é mais verdade no código atual.
- O lock distribuído usa `SET NX PX` com token por aquisição e release protegido por comparação do token em Lua.
- O guard in-process continua ativo dentro de cada job para evitar sobreposição local mesmo com o lock distribuído.

## Documentação Canônica

- [Estado atual](../../docs/CURRENT_STATE.md)
- [Runbook](../../docs/RUNBOOK.md)

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
