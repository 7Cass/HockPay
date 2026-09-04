# Catalogo de eventos

> Arquivo gerado. Nao edite a mao: mude `EVENT_CATALOG` em
> `packages/core/src/domain/constants/event-catalog.ts` (ou os exemplos em
> `event-catalog-examples.ts`) e rode `pnpm docs:events`.

Este e o contrato externo dos webhooks do Hockpay. Todo evento assinavel nasce
no outbox, e entregue pelo worker e chega no endpoint do lojista dentro do
mesmo envelope.

## Envelope

```json
{
  "id": "evt_1f6b0d92",
  "type": "payment.confirmed",
  "version": 1,
  "created_at": "2026-05-15T12:00:00.000Z",
  "data": {
    "...": "o objeto do agregado"
  }
}
```

| Campo | Significado |
| --- | --- |
| `id` | Id do evento no outbox. Estavel entre retries: use para deduplicar. |
| `type` | Tipo do evento, um dos listados abaixo. |
| `version` | Versao do contrato **deste tipo**, congelada quando o evento foi produzido. |
| `created_at` | Quando o evento nasceu, nao quando foi entregue. |
| `data` | O objeto do agregado. `storeId` sempre presente. |

### Sobre `version`

A versao e por tipo, nao global: `payment.confirmed` pode estar em v2 enquanto
`withdrawal.created` segue em v1. Ela e gravada junto com o evento, entao uma
reentrega feita meses depois — inclusive a partir da DLQ — chega com a versao
sob a qual o evento nasceu, e nao com a versao que o codigo tem hoje.

A versao sobe quando a forma de `data` muda de um jeito que quebra quem ja
consome: campo removido, renomeado, ou com o tipo trocado. Campo novo e
opcional nao sobe versao — trate `data` como aberto para extensao.

## Cabecalhos

| Cabecalho | Conteudo |
| --- | --- |
| `X-Hockpay-Signature` | HMAC do corpo com o secret do webhook. |
| `X-Hockpay-Timestamp` | Timestamp usado na assinatura. |
| `X-Hockpay-Webhook-Id` | Id da tentativa de entrega. |
| `X-Request-ID` | Request que originou o evento, quando houver. |

## Todos os eventos

| Tipo | Versao | Agregado | O que aconteceu |
| --- | --- | --- | --- |
| `payment.created` | v1 | `Payment` | Uma cobranca Pix foi criada e o QR code ja pode ser apresentado ao pagador. |
| `payment.confirmed` | v1 | `Payment` | O pagamento foi confirmado e o valor liquido entrou no saldo pendente da loja. |
| `payment.failed` | v1 | `Payment` | Uma tentativa de pagamento falhou. A cobranca segue aberta para nova tentativa. |
| `payment.expired` | v1 | `Payment` | A cobranca expirou sem pagamento e nao aceita mais tentativas. |
| `payment.released` | v1 | `Payment` | O valor saiu do saldo pendente e virou saldo disponivel para saque. |
| `payment.refunded` | v1 | `Payment` | O pagamento foi estornado, total ou parcialmente. |
| `payment_link.created` | v1 | `PaymentLink` | Um Payment Link foi criado e ja pode ser compartilhado. |
| `payment_link.paid` | v1 | `PaymentLink` | Um Payment Link foi pago e esta fechado. |
| `payment_link.expired` | v1 | `PaymentLink` | Um Payment Link expirou sem ser pago. |
| `payment_link.cancelled` | v1 | `PaymentLink` | Um Payment Link foi cancelado pelo lojista antes de ser pago. |
| `withdrawal.created` | v1 | `Withdrawal` | Um saque foi solicitado e o valor ficou reservado no saldo da loja. |
| `withdrawal.processing` | v1 | `Withdrawal` | O saque entrou em processamento. |
| `withdrawal.completed` | v1 | `Withdrawal` | O saque foi concluido e o valor saiu do saldo da loja. |
| `withdrawal.failed` | v1 | `Withdrawal` | O saque falhou e o valor reservado voltou para o saldo disponivel. |

## Payment

### `payment.created`

**v1** · agregado `Payment`

Uma cobranca Pix foi criada e o QR code ja pode ser apresentado ao pagador.

_Quando:_ Na criacao do pagamento, seja por API, checkout session ou Payment Link.

```json
{
  "id": "evt_1f6b0d92",
  "type": "payment.created",
  "version": 1,
  "created_at": "2026-05-15T12:00:00.000Z",
  "data": {
    "id": "pay_9c3e51ab",
    "storeId": "sto_2f8a91c4",
    "customerId": "cus_6e40b2df",
    "pixChargeId": "pch_4b1d77e0",
    "amount": 12990,
    "fee": 379,
    "netAmount": 12611,
    "currency": "BRL",
    "description": "Camiseta Hockpay P",
    "payerName": "Ana Ribeiro",
    "payerDocument": "529.982.247-25",
    "payerEmail": "ana@example.com",
    "status": "PENDING",
    "environment": "TEST",
    "paymentMethod": "PIX",
    "totalRefunded": 0,
    "pixCharge": {
      "id": "pch_4b1d77e0",
      "storeId": "sto_2f8a91c4",
      "amount": 12990,
      "currency": "BRL",
      "status": "OPEN",
      "pixQrCode": "data:image/png;base64,<qr omitido no exemplo>",
      "pixCopyPaste": "00020126580014BR.GOV.BCB.PIX...",
      "pixTxId": "HPL9c3e51ab",
      "expiresAt": "2026-05-15T12:30:00.000Z",
      "createdAt": "2026-05-15T12:00:00.000Z",
      "updatedAt": "2026-05-15T12:00:00.000Z"
    },
    "expiresAt": "2026-05-15T12:30:00.000Z",
    "createdAt": "2026-05-15T12:00:00.000Z",
    "updatedAt": "2026-05-15T12:00:00.000Z",
    "attemptNumber": 1,
    "attemptCount": 1,
    "isLatestAttempt": true
  }
}
```

### `payment.confirmed`

**v1** · agregado `Payment`

O pagamento foi confirmado e o valor liquido entrou no saldo pendente da loja.

_Quando:_ Na liquidacao da cobranca, junto da emissao do recibo e do lancamento no ledger.

```json
{
  "id": "evt_1f6b0d92",
  "type": "payment.confirmed",
  "version": 1,
  "created_at": "2026-05-15T12:00:00.000Z",
  "data": {
    "id": "pay_9c3e51ab",
    "storeId": "sto_2f8a91c4",
    "customerId": "cus_6e40b2df",
    "pixChargeId": "pch_4b1d77e0",
    "amount": 12990,
    "fee": 379,
    "netAmount": 12611,
    "currency": "BRL",
    "description": "Camiseta Hockpay P",
    "payerName": "Ana Ribeiro",
    "payerDocument": "529.982.247-25",
    "payerEmail": "ana@example.com",
    "status": "CONFIRMED",
    "environment": "TEST",
    "paymentMethod": "PIX",
    "totalRefunded": 0,
    "pixCharge": {
      "id": "pch_4b1d77e0",
      "storeId": "sto_2f8a91c4",
      "amount": 12990,
      "currency": "BRL",
      "status": "PAID",
      "pixQrCode": "data:image/png;base64,<qr omitido no exemplo>",
      "pixCopyPaste": "00020126580014BR.GOV.BCB.PIX...",
      "pixTxId": "HPL9c3e51ab",
      "expiresAt": "2026-05-15T12:30:00.000Z",
      "createdAt": "2026-05-15T12:00:00.000Z",
      "updatedAt": "2026-05-15T12:04:12.000Z"
    },
    "expiresAt": "2026-05-15T12:30:00.000Z",
    "createdAt": "2026-05-15T12:00:00.000Z",
    "updatedAt": "2026-05-15T12:04:12.000Z",
    "attemptNumber": 1,
    "attemptCount": 1,
    "isLatestAttempt": true,
    "paidAt": "2026-05-15T12:04:12.000Z"
  }
}
```

### `payment.failed`

**v1** · agregado `Payment`

Uma tentativa de pagamento falhou. A cobranca segue aberta para nova tentativa.

_Quando:_ Quando a tentativa e marcada como falha, por simulacao TEST ou por recusa.

```json
{
  "id": "evt_1f6b0d92",
  "type": "payment.failed",
  "version": 1,
  "created_at": "2026-05-15T12:00:00.000Z",
  "data": {
    "id": "pay_9c3e51ab",
    "storeId": "sto_2f8a91c4",
    "customerId": "cus_6e40b2df",
    "pixChargeId": "pch_4b1d77e0",
    "amount": 12990,
    "fee": 379,
    "netAmount": 12611,
    "currency": "BRL",
    "description": "Camiseta Hockpay P",
    "payerName": "Ana Ribeiro",
    "payerDocument": "529.982.247-25",
    "payerEmail": "ana@example.com",
    "status": "FAILED",
    "environment": "TEST",
    "paymentMethod": "PIX",
    "totalRefunded": 0,
    "pixCharge": {
      "id": "pch_4b1d77e0",
      "storeId": "sto_2f8a91c4",
      "amount": 12990,
      "currency": "BRL",
      "status": "OPEN",
      "pixQrCode": "data:image/png;base64,<qr omitido no exemplo>",
      "pixCopyPaste": "00020126580014BR.GOV.BCB.PIX...",
      "pixTxId": "HPL9c3e51ab",
      "expiresAt": "2026-05-15T12:30:00.000Z",
      "createdAt": "2026-05-15T12:00:00.000Z",
      "updatedAt": "2026-05-15T12:00:00.000Z"
    },
    "expiresAt": "2026-05-15T12:30:00.000Z",
    "createdAt": "2026-05-15T12:00:00.000Z",
    "updatedAt": "2026-05-15T12:00:00.000Z",
    "attemptNumber": 2,
    "attemptCount": 2,
    "isLatestAttempt": true,
    "failedReason": "card_declined"
  }
}
```

### `payment.expired`

**v1** · agregado `Payment`

A cobranca expirou sem pagamento e nao aceita mais tentativas.

_Quando:_ Pelo job de expiracao no worker, ou pelo endpoint TEST de simulacao.

```json
{
  "id": "evt_1f6b0d92",
  "type": "payment.expired",
  "version": 1,
  "created_at": "2026-05-15T12:00:00.000Z",
  "data": {
    "id": "pay_9c3e51ab",
    "storeId": "sto_2f8a91c4",
    "customerId": "cus_6e40b2df",
    "pixChargeId": "pch_4b1d77e0",
    "amount": 12990,
    "fee": 379,
    "netAmount": 12611,
    "currency": "BRL",
    "description": "Camiseta Hockpay P",
    "payerName": "Ana Ribeiro",
    "payerDocument": "529.982.247-25",
    "payerEmail": "ana@example.com",
    "status": "EXPIRED",
    "environment": "TEST",
    "paymentMethod": "PIX",
    "totalRefunded": 0,
    "pixCharge": {
      "id": "pch_4b1d77e0",
      "storeId": "sto_2f8a91c4",
      "amount": 12990,
      "currency": "BRL",
      "status": "EXPIRED",
      "pixQrCode": "data:image/png;base64,<qr omitido no exemplo>",
      "pixCopyPaste": "00020126580014BR.GOV.BCB.PIX...",
      "pixTxId": "HPL9c3e51ab",
      "expiresAt": "2026-05-15T12:30:00.000Z",
      "createdAt": "2026-05-15T12:00:00.000Z",
      "updatedAt": "2026-05-15T12:00:00.000Z"
    },
    "expiresAt": "2026-05-15T12:30:00.000Z",
    "createdAt": "2026-05-15T12:00:00.000Z",
    "updatedAt": "2026-05-15T12:00:00.000Z",
    "attemptNumber": 1,
    "attemptCount": 1,
    "isLatestAttempt": true
  }
}
```

### `payment.released`

**v1** · agregado `Payment`

O valor saiu do saldo pendente e virou saldo disponivel para saque.

_Quando:_ Na liberacao do repasse, apos o periodo de retencao.

```json
{
  "id": "evt_1f6b0d92",
  "type": "payment.released",
  "version": 1,
  "created_at": "2026-05-15T12:00:00.000Z",
  "data": {
    "id": "pay_9c3e51ab",
    "storeId": "sto_2f8a91c4",
    "customerId": "cus_6e40b2df",
    "pixChargeId": "pch_4b1d77e0",
    "amount": 12990,
    "fee": 379,
    "netAmount": 12611,
    "currency": "BRL",
    "description": "Camiseta Hockpay P",
    "payerName": "Ana Ribeiro",
    "payerDocument": "529.982.247-25",
    "payerEmail": "ana@example.com",
    "status": "RELEASED",
    "environment": "TEST",
    "paymentMethod": "PIX",
    "totalRefunded": 0,
    "pixCharge": {
      "id": "pch_4b1d77e0",
      "storeId": "sto_2f8a91c4",
      "amount": 12990,
      "currency": "BRL",
      "status": "PAID",
      "pixQrCode": "data:image/png;base64,<qr omitido no exemplo>",
      "pixCopyPaste": "00020126580014BR.GOV.BCB.PIX...",
      "pixTxId": "HPL9c3e51ab",
      "expiresAt": "2026-05-15T12:30:00.000Z",
      "createdAt": "2026-05-15T12:00:00.000Z",
      "updatedAt": "2026-05-15T12:04:12.000Z"
    },
    "expiresAt": "2026-05-15T12:30:00.000Z",
    "createdAt": "2026-05-15T12:00:00.000Z",
    "updatedAt": "2026-05-15T12:04:12.000Z",
    "attemptNumber": 1,
    "attemptCount": 1,
    "isLatestAttempt": true,
    "paidAt": "2026-05-15T12:04:12.000Z",
    "releasedAt": "2026-05-17T12:04:12.000Z"
  }
}
```

### `payment.refunded`

**v1** · agregado `Payment`

O pagamento foi estornado, total ou parcialmente.

_Quando:_ Na conclusao do estorno, com o lancamento de debito ja no ledger.

```json
{
  "id": "evt_1f6b0d92",
  "type": "payment.refunded",
  "version": 1,
  "created_at": "2026-05-15T12:00:00.000Z",
  "data": {
    "id": "pay_9c3e51ab",
    "storeId": "sto_2f8a91c4",
    "customerId": "cus_6e40b2df",
    "pixChargeId": "pch_4b1d77e0",
    "amount": 12990,
    "fee": 379,
    "netAmount": 12611,
    "currency": "BRL",
    "description": "Camiseta Hockpay P",
    "payerName": "Ana Ribeiro",
    "payerDocument": "529.982.247-25",
    "payerEmail": "ana@example.com",
    "status": "REFUNDED",
    "environment": "TEST",
    "paymentMethod": "PIX",
    "totalRefunded": 12990,
    "pixCharge": {
      "id": "pch_4b1d77e0",
      "storeId": "sto_2f8a91c4",
      "amount": 12990,
      "currency": "BRL",
      "status": "PAID",
      "pixQrCode": "data:image/png;base64,<qr omitido no exemplo>",
      "pixCopyPaste": "00020126580014BR.GOV.BCB.PIX...",
      "pixTxId": "HPL9c3e51ab",
      "expiresAt": "2026-05-15T12:30:00.000Z",
      "createdAt": "2026-05-15T12:00:00.000Z",
      "updatedAt": "2026-05-15T12:04:12.000Z"
    },
    "expiresAt": "2026-05-15T12:30:00.000Z",
    "createdAt": "2026-05-15T12:00:00.000Z",
    "updatedAt": "2026-05-15T12:04:12.000Z",
    "attemptNumber": 1,
    "attemptCount": 1,
    "isLatestAttempt": true,
    "paidAt": "2026-05-15T12:04:12.000Z"
  }
}
```

## PaymentLink

### `payment_link.created`

**v1** · agregado `PaymentLink`

Um Payment Link foi criado e ja pode ser compartilhado.

_Quando:_ Na criacao do link, por API ou pelo dashboard — util para quem cria links fora do proprio backend.

```json
{
  "id": "evt_1f6b0d92",
  "type": "payment_link.created",
  "version": 1,
  "created_at": "2026-05-15T12:00:00.000Z",
  "data": {
    "id": "lnk_7d20f6c1",
    "status": "ACTIVE",
    "amount": 12990,
    "currency": "BRL",
    "environment": "TEST",
    "title": "Camiseta Hockpay",
    "description": "Tamanho P, entrega em 5 dias uteis",
    "internal_reference": "pedido-4471",
    "checkout_url": "https://checkout.hockpay.dev/pay/9f2c1ba0e7d4",
    "pix_charge_id": "pch_4b1d77e0",
    "items": [
      {
        "id": "pli_0b73d914",
        "productId": "prd_51ce8a20",
        "productExternalId": "camiseta-p",
        "name": "Camiseta Hockpay",
        "description": "Tamanho P",
        "quantity": 1,
        "unitPrice": 12990,
        "totalPrice": 12990,
        "imageUrl": "https://cdn.example.com/camiseta-p.png",
        "createdAt": "2026-05-15T12:00:00.000Z",
        "updatedAt": "2026-05-15T12:00:00.000Z"
      }
    ],
    "payment_id": null,
    "failed_payment_count": 0,
    "expires_at": "2026-05-15T12:30:00.000Z",
    "opened_at": null,
    "cancelled_at": null,
    "created_at": "2026-05-15T12:00:00.000Z",
    "updated_at": "2026-05-15T12:00:00.000Z",
    "storeId": "sto_2f8a91c4"
  }
}
```

### `payment_link.paid`

**v1** · agregado `PaymentLink`

Um Payment Link foi pago e esta fechado.

_Quando:_ Na liquidacao da tentativa que confirmou o link, logo apos o `payment.confirmed` correspondente.

```json
{
  "id": "evt_1f6b0d92",
  "type": "payment_link.paid",
  "version": 1,
  "created_at": "2026-05-15T12:00:00.000Z",
  "data": {
    "id": "lnk_7d20f6c1",
    "status": "PAID",
    "amount": 12990,
    "currency": "BRL",
    "environment": "TEST",
    "title": "Camiseta Hockpay",
    "description": "Tamanho P, entrega em 5 dias uteis",
    "internal_reference": "pedido-4471",
    "checkout_url": "https://checkout.hockpay.dev/pay/9f2c1ba0e7d4",
    "pix_charge_id": "pch_4b1d77e0",
    "items": [
      {
        "id": "pli_0b73d914",
        "productId": "prd_51ce8a20",
        "productExternalId": "camiseta-p",
        "name": "Camiseta Hockpay",
        "description": "Tamanho P",
        "quantity": 1,
        "unitPrice": 12990,
        "totalPrice": 12990,
        "imageUrl": "https://cdn.example.com/camiseta-p.png",
        "createdAt": "2026-05-15T12:00:00.000Z",
        "updatedAt": "2026-05-15T12:00:00.000Z"
      }
    ],
    "payment_id": "pay_9c3e51ab",
    "failed_payment_count": 0,
    "expires_at": "2026-05-15T12:30:00.000Z",
    "opened_at": "2026-05-15T12:02:00.000Z",
    "cancelled_at": null,
    "created_at": "2026-05-15T12:00:00.000Z",
    "updated_at": "2026-05-15T12:00:00.000Z",
    "storeId": "sto_2f8a91c4"
  }
}
```

### `payment_link.expired`

**v1** · agregado `PaymentLink`

Um Payment Link expirou sem ser pago.

_Quando:_ Quando a cobranca por tras do link expira, pelo job de expiracao ou por simulacao TEST. Atencao: o job varre `Payment`, nao `PaymentLink` -- um link que venceu sem nenhuma tentativa de pagamento aparece como EXPIRED na leitura, mas nao produz este evento. Enquanto o status do link for derivado e nao houver varredura por link, conte com a leitura para esse caso.

```json
{
  "id": "evt_1f6b0d92",
  "type": "payment_link.expired",
  "version": 1,
  "created_at": "2026-05-15T12:00:00.000Z",
  "data": {
    "id": "lnk_7d20f6c1",
    "status": "EXPIRED",
    "amount": 12990,
    "currency": "BRL",
    "environment": "TEST",
    "title": "Camiseta Hockpay",
    "description": "Tamanho P, entrega em 5 dias uteis",
    "internal_reference": "pedido-4471",
    "checkout_url": "https://checkout.hockpay.dev/pay/9f2c1ba0e7d4",
    "pix_charge_id": "pch_4b1d77e0",
    "items": [
      {
        "id": "pli_0b73d914",
        "productId": "prd_51ce8a20",
        "productExternalId": "camiseta-p",
        "name": "Camiseta Hockpay",
        "description": "Tamanho P",
        "quantity": 1,
        "unitPrice": 12990,
        "totalPrice": 12990,
        "imageUrl": "https://cdn.example.com/camiseta-p.png",
        "createdAt": "2026-05-15T12:00:00.000Z",
        "updatedAt": "2026-05-15T12:00:00.000Z"
      }
    ],
    "payment_id": null,
    "failed_payment_count": 0,
    "expires_at": "2026-05-15T12:30:00.000Z",
    "opened_at": null,
    "cancelled_at": null,
    "created_at": "2026-05-15T12:00:00.000Z",
    "updated_at": "2026-05-15T12:00:00.000Z",
    "storeId": "sto_2f8a91c4"
  }
}
```

### `payment_link.cancelled`

**v1** · agregado `PaymentLink`

Um Payment Link foi cancelado pelo lojista antes de ser pago.

_Quando:_ No cancelamento do link, que tambem cancela a cobranca aberta.

```json
{
  "id": "evt_1f6b0d92",
  "type": "payment_link.cancelled",
  "version": 1,
  "created_at": "2026-05-15T12:00:00.000Z",
  "data": {
    "id": "lnk_7d20f6c1",
    "status": "CANCELLED",
    "amount": 12990,
    "currency": "BRL",
    "environment": "TEST",
    "title": "Camiseta Hockpay",
    "description": "Tamanho P, entrega em 5 dias uteis",
    "internal_reference": "pedido-4471",
    "checkout_url": "https://checkout.hockpay.dev/pay/9f2c1ba0e7d4",
    "pix_charge_id": "pch_4b1d77e0",
    "items": [
      {
        "id": "pli_0b73d914",
        "productId": "prd_51ce8a20",
        "productExternalId": "camiseta-p",
        "name": "Camiseta Hockpay",
        "description": "Tamanho P",
        "quantity": 1,
        "unitPrice": 12990,
        "totalPrice": 12990,
        "imageUrl": "https://cdn.example.com/camiseta-p.png",
        "createdAt": "2026-05-15T12:00:00.000Z",
        "updatedAt": "2026-05-15T12:00:00.000Z"
      }
    ],
    "payment_id": null,
    "failed_payment_count": 0,
    "expires_at": "2026-05-15T12:30:00.000Z",
    "opened_at": null,
    "cancelled_at": "2026-05-15T12:10:00.000Z",
    "created_at": "2026-05-15T12:00:00.000Z",
    "updated_at": "2026-05-15T12:00:00.000Z",
    "storeId": "sto_2f8a91c4"
  }
}
```

## Withdrawal

### `withdrawal.created`

**v1** · agregado `Withdrawal`

Um saque foi solicitado e o valor ficou reservado no saldo da loja.

_Quando:_ Na criacao do saque, com a reserva de saldo ja aplicada.

```json
{
  "id": "evt_1f6b0d92",
  "type": "withdrawal.created",
  "version": 1,
  "created_at": "2026-05-15T12:00:00.000Z",
  "data": {
    "id": "wdl_1a5c8e93",
    "accountId": "acc_3d91f7b2",
    "bankAccountId": "bnk_88a2c105",
    "amount": 50000,
    "fee": 350,
    "netAmount": 49650,
    "environment": "TEST",
    "status": "PENDING",
    "processingAttempts": 0,
    "createdAt": "2026-05-15T12:00:00.000Z",
    "updatedAt": "2026-05-15T12:00:00.000Z",
    "storeId": "sto_2f8a91c4"
  }
}
```

### `withdrawal.processing`

**v1** · agregado `Withdrawal`

O saque entrou em processamento.

_Quando:_ Quando o worker assume o saque para processar.

```json
{
  "id": "evt_1f6b0d92",
  "type": "withdrawal.processing",
  "version": 1,
  "created_at": "2026-05-15T12:00:00.000Z",
  "data": {
    "id": "wdl_1a5c8e93",
    "accountId": "acc_3d91f7b2",
    "bankAccountId": "bnk_88a2c105",
    "amount": 50000,
    "fee": 350,
    "netAmount": 49650,
    "environment": "TEST",
    "status": "PROCESSING",
    "processingAttempts": 0,
    "createdAt": "2026-05-15T12:00:00.000Z",
    "updatedAt": "2026-05-15T12:00:00.000Z",
    "storeId": "sto_2f8a91c4"
  }
}
```

### `withdrawal.completed`

**v1** · agregado `Withdrawal`

O saque foi concluido e o valor saiu do saldo da loja.

_Quando:_ Na conclusao do saque simulado, com o debito lancado no ledger.

```json
{
  "id": "evt_1f6b0d92",
  "type": "withdrawal.completed",
  "version": 1,
  "created_at": "2026-05-15T12:00:00.000Z",
  "data": {
    "id": "wdl_1a5c8e93",
    "accountId": "acc_3d91f7b2",
    "bankAccountId": "bnk_88a2c105",
    "amount": 50000,
    "fee": 350,
    "netAmount": 49650,
    "environment": "TEST",
    "status": "COMPLETED",
    "processingAttempts": 0,
    "createdAt": "2026-05-15T12:00:00.000Z",
    "updatedAt": "2026-05-15T12:00:00.000Z",
    "paidAt": "2026-05-15T12:20:00.000Z",
    "pixE2eId": "E1234567820260515122000abcdef123",
    "storeId": "sto_2f8a91c4"
  }
}
```

### `withdrawal.failed`

**v1** · agregado `Withdrawal`

O saque falhou e o valor reservado voltou para o saldo disponivel.

_Quando:_ Na falha do processamento, apos a devolucao da reserva.

```json
{
  "id": "evt_1f6b0d92",
  "type": "withdrawal.failed",
  "version": 1,
  "created_at": "2026-05-15T12:00:00.000Z",
  "data": {
    "id": "wdl_1a5c8e93",
    "accountId": "acc_3d91f7b2",
    "bankAccountId": "bnk_88a2c105",
    "amount": 50000,
    "fee": 350,
    "netAmount": 49650,
    "environment": "TEST",
    "status": "FAILED",
    "processingAttempts": 0,
    "createdAt": "2026-05-15T12:00:00.000Z",
    "updatedAt": "2026-05-15T12:00:00.000Z",
    "failedReason": "bank_rejected",
    "storeId": "sto_2f8a91c4"
  }
}
```

## Disparos de teste

Nao sao assinaveis e nao passam pelo outbox: so acontecem quando o lojista pede
um teste. Hoje eles **nao** usam o envelope acima — vao com um corpo proprio,
mais simples. Entao um teste bem-sucedido prova que a URL responde e que a
assinatura confere, mas nao exercita o parser do evento real.

### `webhook.test`

**v1** · agregado `WebhookConfig`

Disparo de teste para o lojista validar assinatura e endpoint.

_Quando:_ Somente quando o lojista pede um teste no dashboard ou pela API. Nao passa pelo outbox e nao carrega o envelope.

```json
{
  "test": true,
  "timestamp": 1778846400,
  "message": "This is a test webhook from Hockpay",
  "configId": "whc_2c9e4470"
}
```

### `alert.test`

**v1** · agregado `AlertConfig`

Disparo de teste para o lojista validar um canal de alerta.

_Quando:_ Somente quando o lojista pede um teste de alerta. Vai pelo canal do alerta (Discord), nao por webhook.

```json
{
  "test": true,
  "message": "Teste de alerta Hockpay",
  "alertConfigId": "alc_5f13ba82",
  "createdAt": "2026-05-15T12:00:00.000Z"
}
```
