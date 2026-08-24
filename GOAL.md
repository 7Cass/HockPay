# Hockpay - Goal

Nao ha goal ativa.

Source repo: `/Users/jpcass/Documents/2026/hockpay`
Last reviewed: `2026-08-19`

A quarta passagem (arquivada em `docs/goals/2026-08-19-test-live-identity-isolation.md`) fechou isolamento de identidade TEST/LIVE (`Idempotency-Key` e `Payment.externalId` por `storeId + environment`), unique Prisma conhecido como 409, e README da API alinhado ao runtime (JWT-only de saque/estorno; `Idempotency-Key` no create de checkout session).

Passagens anteriores em `docs/goals/`:

- `2026-08-18-architecture-hardening.md`
- `2026-08-18-workspace-honesty-and-integrity.md`
- `2026-08-19-leftover-authz-and-read-isolation.md`
- `2026-08-19-test-live-identity-isolation.md`
