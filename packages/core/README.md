# `@hockpay/core`

Pacote central do domínio e da aplicação. Ele concentra entidades, value objects, erros, interfaces de repositório/portas e use cases compartilhados.

## Estado Atual

- Sem dependência de NestJS
- Sem dependência direta de Prisma
- Exporta:
  - entidades como `Merchant`, `Store`, `Customer`, `Payment`, `PixCharge`, `PaymentLink`, `Product`, `PaymentItem`, `WebhookConfig`, `WebhookLog`, `AlertConfig`, `Account`, `Transaction`, `Refund`, `Receipt`, `BankAccount` e `Withdrawal`
  - value objects como `Email`, `Document`, `Environment`
  - interfaces de repositório e portas
  - use cases do fluxo principal

## Estrutura Atual

| Área                    | Conteúdo                       |
| ----------------------- | ------------------------------ |
| `domain/entities`       | aggregates e entidades         |
| `domain/value-objects`  | VOs atuais do domínio          |
| `domain/errors`         | erros de negócio               |
| `domain/repositories`   | contratos de persistência      |
| `application/ports`     | contratos de adapters externos |
| `application/services`  | lógica compartilhada           |
| `application/use-cases` | casos de uso reais do sistema  |

## Observações

- A documentação antiga citava `PixKey` e `Domain Events` como parte consolidada do pacote; isso não corresponde ao conjunto atual exportado.
- Valores monetarios sao `number` em centavos. Invariantes ficam em `Payment.create`, `FeePolicy` e policies de saque.
- A cidade EMV do Pix usa `resolvePixMerchantCity`; sem cidade da store o fallback documentado e `SAO PAULO`.

## Casos de Uso Relevantes

- merchants/auth
- stores/api keys
- customers
- payments e simulação
- PixCharge e Payment Links
- webhooks
- alerts
- checkout sessions
- dashboard/account/transactions
- bank accounts
- receipts
- refunds
- withdrawals
- customer history
- products/catalog

## Limites

- `Product` e `PaymentItem` fazem parte do core atual para catalogo e snapshots de checkout sessions. Payment Links seguem como cobranca avulsa por `amount`, sem items de produto.
- `PaymentMethod` tem valores modelados alem de Pix, mas nao ha use case de processamento real para cartao, boleto ou debito.

## Scripts

```bash
pnpm build
pnpm test
pnpm test:cov
```

[Documentação de estado atual](../../docs/CURRENT_STATE.md) · [Voltar ao README raiz](../../README.md)
