# Changelog

## Unreleased

### P1 - Confiabilidade financeira e webhook

- `ReleasePaymentUseCase` agora retorna idempotentemente para payments `RELEASED`, sem recriar transaction/outbox nem mutar balances.
- `ProcessWebhookUseCase` entrega webhooks para multiplas configs em paralelo, isola falhas por config e so marca outbox como processado quando todas entregam com sucesso.
- Eventos outbox de payment agora gravam `storeId` top-level explicitamente no payload; o processor de webhook nao depende mais de fallback aninhado para rotear configs.
- `FailPaymentUseCase` agora retorna idempotentemente para payments `FAILED`, sem recriar outbox nem atualizar payment, e ainda cancela expiracao pendente.
- `POST /api/v1/refunds` agora exige `Idempotency-Key`, alinhando retries de refund ao mecanismo ja usado em criacao de payment.
- `docs/P_ROADMAP.md` marca P1 como concluida e registra os criterios P1.9 a P1.13.

### Verification

- `pnpm --filter @hockpay/api test`
- `pnpm --filter @hockpay/core test -- --run`
- `pnpm run build`
