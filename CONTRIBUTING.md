# Contributing

Hockpay is a TypeScript-first `pnpm` workspace. Keep changes small,
behavior-focused, and aligned with the existing package boundaries.

## Local Setup

```bash
pnpm install
docker compose -f infrastructure/docker/docker-compose.yml up -d
pnpm db:generate
pnpm db:migrate
pnpm dev
```

## Development Guidelines

- Keep domain rules in `packages/core`.
- Keep persistence and framework adapters outside the core package.
- Prefer package-filtered commands while iterating.
- Add focused tests next to the code under change.
- Do not commit secrets, local `.env` files, generated build info, or personal
  customer documents.

## Useful Checks

```bash
pnpm --filter @hockpay/core test:ci
pnpm --filter @hockpay/infrastructure test
pnpm --filter @hockpay/api test
pnpm --filter @hockpay/api test:e2e
pnpm --filter @hockpay/worker test
```

For broader validation before opening a PR, run:

```bash
pnpm build
pnpm test
```

## Commit Style

Use Conventional Commits where possible, for example:

```text
feat(web): add payment timeline filters
fix(api): preserve store scoping on receipt lookup
test(smoke): cover hosted checkout retry flow
```

PRs should include a concise summary, test results, screenshots for UI changes,
and notes for migrations, environment variables, queue behavior, or smoke-test
impact.
