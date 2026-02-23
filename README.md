# Hockpay

Plataforma de pagamentos Pix **simulada** para desenvolvedores independentes e pequenas startups.

> **Aviso:** Este é um simulador com rigor técnico. Nunca processe dinheiro real.

## Visão Geral

Monorepo construído com Turborepo e pnpm workspaces, contendo:

- **apps/** - Aplicações (API, Worker, Dashboard, Checkout, Landing)
- **packages/** - Pacotes compartilhados (Core, Database, Config, DTO, UI)

## Começo Rápido

```bash
# Instalar dependências
pnpm install

# Rodar todos os serviços em desenvolvimento
pnpm dev

# Build de todos os pacotes
pnpm build

# Rodar testes
pnpm test

# Lint
pnpm lint

# Limpar builds e node_modules
pnpm clean
```

## Documentação

- [CLAUDE.md](./CLAUDE.md) - Instruções para Claude Code e desenvolvedores
- [TECHNICAL_OVERVIEW.md](./TECHNICAL_OVERVIEW.md) - Documentação técnica completa

## Licença

MIT
