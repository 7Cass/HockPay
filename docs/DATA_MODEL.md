# Hockpay - Modelo de Dados

Este documento resume o schema Prisma e sua cobertura real no runtime. A fonte tecnica do schema continua sendo `packages/database/prisma/schema.prisma`.

## Inventario

| Grupo | Entidades | Cobertura runtime |
| --- | --- | --- |
| Identidade | `Merchant`, `RefreshToken`, `ApiKey`, `IdempotencyKey` | Implementada. |
| Negocio | `Store`, `Customer`, `CheckoutSession`, `PaymentLink` | Implementada, exceto catalogo. |
| Pagamento | `Payment`, `PixCharge`, `PaymentItem`, `Product` | `Payment`/`PixCharge` implementados; `Product`/`PaymentItem` parciais. |
| Financeiro | `Account`, `Transaction`, `Refund`, `Receipt`, `ReceiptCounter`, `BankAccount`, `Withdrawal` | Implementada para saldos, ledger, receipts, refunds, bank accounts e withdrawals simulados. |
| Integracao | `WebhookConfig`, `WebhookLog`, `WebhookInboxEvent`, `OutboxEvent` | Implementada. |
| Alertas | `AlertConfig`, `AlertDeliveryLog` | Implementada para alerta operacional. |

## Entidades Principais

### Store e Account

- `Store` e o escopo principal de merchant.
- Toda store criada pela API recebe `Account`.
- `Account` guarda saldos `available`, `pending` e `blocked`.
- `Transaction` registra o ledger financeiro com `referenceType` e `referenceId`.

### Payment e PixCharge

- `Payment` pertence a uma `Store` e opcionalmente a um `Customer`.
- `PixCharge` representa a cobranca Pix simulada e pode agrupar tentativas.
- Estados de `Payment`: `PENDING`, `CONFIRMED`, `RELEASED`, `EXPIRED`, `FAILED`, `REFUNDED`.
- `PaymentMethod` inclui `PIX`, `CREDIT_CARD`, `BOLETO` e `DEBIT_CARD`, mas o processamento real atual continua simulado e centrado em Pix.

### PaymentLink

- `PaymentLink` referencia uma `PixCharge` unica.
- `publicToken` e usado pelo checkout publico em `/pay/:token`.
- Falhas criam tentativas `Payment` sem encerrar a `PixCharge`.
- Pagamento bem-sucedido fecha a `PixCharge` como `PAID`.

### CheckoutSession

- `CheckoutSession` guarda token, valor, URLs de retorno, estado e opcionalmente `Payment`.
- `fulfill` cria/submete pagamento conforme o modo de coleta de customer.

### BankAccount e Withdrawal

- `BankAccount` pertence a uma store, pode ser default e precisa estar verificada para receber saque.
- `Withdrawal` guarda valor bruto, taxa, liquido, status, tentativas de processamento, erro tecnico e referencia Pix simulada.
- Estados de `Withdrawal`: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`.
- `Withdrawal` usa ledger:
  - `WITHDRAWAL_RESERVED`
  - `WITHDRAWAL_SENT`
  - `WITHDRAWAL_REVERSED`

### Receipts

- `Receipt` e unico por `Payment`.
- `ReceiptCounter` mantem sequencia por store/dia.
- Receipts aparecem em API, dashboard e timeline de payment.

### Webhooks e Outbox

- `OutboxEvent` e a fonte de eventos assincronos.
- `WebhookLog` persiste tentativas, resposta, `requestId`, `outboxEventId`, `paymentId` e campos de agregado.
- `WebhookInboxEvent` existe para eventos recebidos em ambiente de desenvolvimento/teste.

### Alerts

- `AlertConfig` guarda canal, eventos e configuracao criptografada.
- `AlertDeliveryLog` guarda tentativas, status e resposta do destino.

### Product e PaymentItem

- `Product` e `PaymentItem` existem no schema.
- O dashboard tem rota visual de products.
- Nao ha slice consolidado de catalogo no backend/core/API.
- O fluxo atual de pagamento nao depende de itens de carrinho.

## Regras Financeiras Atuais

- Valores monetarios sao inteiros em centavos.
- Criacao de pagamento calcula taxa a partir da configuracao da store.
- Pagamento confirmado aumenta saldo `pending`; release move para `available`.
- Refund ajusta saldos e ledger conforme valor estornado.
- Withdrawal reserva saldo disponivel, deduz em sucesso ou devolve em falha.
- A taxa fixa v1 de saque e 199 centavos.
- Limites v1 de saque:
  - minimo: 1000 centavos
  - maximo: 500000 centavos
  - limite diario de valor: 1000000 centavos
  - limite diario de quantidade: 10 saques

## Gaps Schema vs Runtime

- `Product`/`PaymentItem` ainda precisam ser implementados de ponta a ponta ou removidos do escopo visivel.
- `PaymentMethod` aceita metodos alem de Pix, mas nao ha processadores reais para cartao, boleto ou debito.
- Settings nao possui modelo completo de configuracao mutavel.
- Marketplace, split e multi-seller nao estao modelados como produto atual.

