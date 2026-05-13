# `@hockpay/worker`

Worker NestJS separado para processamento assíncrono e tarefas agendadas.

## Estado Atual

- Framework: NestJS 11
- Porta padrão: `3001`
- Filas: BullMQ sobre Redis
- Cron jobs usam guard in-process para evitar sobreposição dentro do mesmo worker
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

## Jobs Atuais

| Job | Agendamento atual | Função |
|-----|-------------------|--------|
| `OutboxDispatcherJob` | a cada 10 segundos | lê `OutboxEvent` pendente e empilha no BullMQ |
| `PaymentExpirationJob` | a cada 1 minuto | expira pagamentos pendentes vencidos |
| `SettlementJob` | diariamente à meia-noite | libera pagamentos confirmados conforme `settlementDays` |
| `CleanupLogsJob` | diariamente às 03:00 | remove logs antigos e eventos processados |
| `CleanupIdempotencyKeysJob` | diariamente às 04:00 | remove chaves expiradas |
| `AntiFraudJob` | a cada 1 hora | varredura simulada de anomalias |

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

## Observações

- O worker atual usa Redis/BullMQ; SQS/LocalStack não fazem parte do runtime atual.
- A documentação antiga dizia que o outbox partia de `WebhookLog`; isso não é mais verdade no código atual.
- O guard de cron atual é in-process. Ele evita execuções simultâneas no mesmo processo, mas não é lock distribuído para múltiplas réplicas.

## Scripts

```bash
pnpm dev
pnpm build
pnpm test
pnpm start:prod
```

[Voltar ao README raiz](../../README.md)
