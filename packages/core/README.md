# `@hockpay/core`

Pacote central do domínio e da aplicação. Ele concentra entidades, value objects, erros, interfaces de repositório/portas e use cases compartilhados.

## Estado Atual

- Sem dependência de NestJS
- Sem dependência direta de Prisma
- Exporta:
  - entidades como `Merchant`, `Store`, `Customer`, `Payment`, `WebhookConfig`, `WebhookLog`, `Account`, `Refund`, `Receipt`
  - value objects como `Email`, `Document`, `Environment`, `Money`
  - interfaces de repositório e portas
  - use cases do fluxo principal

## Estrutura Atual

| Área | Conteúdo |
|------|----------|
| `domain/entities` | aggregates e entidades |
| `domain/value-objects` | VOs atuais do domínio |
| `domain/errors` | erros de negócio |
| `domain/repositories` | contratos de persistência |
| `application/ports` | contratos de adapters externos |
| `application/services` | lógica compartilhada |
| `application/use-cases` | casos de uso reais do sistema |

## Observações

- A documentação antiga citava `PixKey` e `Domain Events` como parte consolidada do pacote; isso não corresponde ao conjunto atual exportado.
- `Money` existe no pacote, mas nem todos os aggregates o usam como tipo central.

## Casos de Uso Relevantes

- merchants/auth
- stores/api keys
- customers
- payments e simulação
- webhooks
- checkout sessions
- dashboard/account/transactions
- bank accounts
- receipts
- refunds

## Scripts

```bash
pnpm build
pnpm test
pnpm test:cov
```

[Voltar ao README raiz](../../README.md)
