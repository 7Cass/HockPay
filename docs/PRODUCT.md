# Hockpay - Produto

Hockpay e uma plataforma dev-first de pagamentos simulados para desenvolvedores independentes, estudantes e pequenas startups que precisam demonstrar, testar ou treinar integracoes de pagamento sem processar dinheiro real.

## Proposta de Valor

- Criar um ambiente local reproduzivel para pagamentos Pix simulados.
- Reduzir o tempo ate o primeiro pagamento, primeiro webhook e primeiro checkout demonstravel.
- Oferecer dashboard operacional para investigar payments, receipts, webhooks, saldos e saques simulados.
- Dar um caminho simples para study-cases e demos integradas, como `apps/demo-mediakit`.

## Personas

| Persona | Necessidade |
| --- | --- |
| Desenvolvedor indie | Testar checkout, webhooks, idempotencia e estados de pagamento sem conta em adquirente. |
| Pequena startup | Demonstrar fluxo de pagamento e pos-venda antes de contratar infraestrutura real. |
| Estudante/mentor | Ensinar integracao de API, webhook assinado, fila e dashboard operacional. |
| Builder de demo | Montar study-case com checkout hospedado, simulacao TEST e recebimento de webhook. |

## Jornadas Atuais

### Primeiro pagamento por API

1. Merchant cria conta, store e API key TEST.
2. Integrador chama `POST /api/v1/payments` com `Idempotency-Key`.
3. Em TEST, confirma ou falha o pagamento por endpoint de simulacao.
4. Dashboard mostra payment, timeline, receipt quando aplicavel, saldo e transaction.
5. Worker entrega webhook assinado ao integrador.

### Checkout hospedado

1. Integrador cria uma checkout session.
2. Comprador acessa `apps/checkout`, informa dados minimos e finaliza.
3. O checkout acompanha o status e permite simulacao em ambiente TEST.
4. A demo recebe webhook e libera a experiencia final.

### Payment Link

1. Merchant cria um link de cobranca com valor direto.
2. Comprador acessa `/pay/:token`.
3. Cada falha/pagamento vira uma tentativa `Payment` ligada a uma `PixCharge`.
4. Dashboard permite acompanhar o link, tentativas e conversao.

### Catalogo de Products

1. Merchant cria produtos vendaveis em `/dashboard/products` ou via `/api/v1/products`.
2. Integrador cria checkout sessions com `items` pela API, referenciando produtos por `productId`.
3. Checkout publico mostra resumo compacto dos itens sem metadata privada.
4. Pagamento final recebe snapshots em `PaymentItem`, visiveis em APIs autenticadas, recibos e webhooks.

### Operacao financeira simulada

1. Merchant acompanha saldos e transactions em `/dashboard/financials`.
2. Merchant cadastra destinos Pix e solicita saques em `/dashboard/withdrawals`.
3. Saques reservam saldo, geram ledger e podem ser completados/falhados em TEST.

## Cobertura de Produto

| Area | Estado de produto |
| --- | --- |
| Pagamento Pix simulado | Pronto para uso local/demo. |
| Checkout hospedado | Pronto para uso local/demo. |
| Payment Links | Pronto para uso local/demo. |
| Webhooks assinados | Pronto para uso local/demo com logs e retry. |
| Receipts e timeline | Pronto para investigacao operacional. |
| Financials read-only | Pronto para consulta de saldo/extrato. |
| Withdrawals simulados | Pronto para API e dashboard em TEST/local. |
| Alerts | Pronto para configuracao operacional basica. |
| Products/catalog | Pronto como catalogo opcional para checkout sessions. |
| Settings | Parcial/read-only. |
| Marketplace/split/multi-seller | Fora do produto atual. |

## Limites Nao Negociaveis

- Hockpay nao movimenta dinheiro real.
- Nao ha Pix real, adquirencia real, payout bancario real ou liquidacao externa.
- Cartao, boleto e debito aparecem no modelo, mas nao sao metodos processados de ponta a ponta.
- Qualquer promessa publica deve deixar claro que o produto atual e simulador/dev tooling.

## Indicadores de Sucesso

- Tempo ate primeiro pagamento TEST confirmado.
- Tempo ate primeiro webhook entregue.
- Numero de demos/study-cases que rodam com `smoke:docker`.
- Capacidade de investigar um caso pelo dashboard sem abrir o banco.
