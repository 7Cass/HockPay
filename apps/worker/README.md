# ⚙️ `@hockpay/worker`

[![NestJS](https://img.shields.io/badge/NestJS-11-red.svg)](https://nestjs.com/)

A aplicação `worker` do Hockpay é um microserviço headless (sem exposição HTTP pública) concebido puramente para **processamento assíncrono em background**.

Ele atua em conjunto com a API principal, consumindo tarefas pendentes do banco de dados (via cron) ou de filas (BullMQ/Redis ou AWS SQS injetado pelo `@hockpay/infrastructure`). Seu maior foco é a estabilidade térmica das transações financeiras e envio confiável de webhooks (Pattern Outbox).

## 🕒 Cron Jobs & Filas

O Worker orquestra diferentes tipos de processos:

| Job | Scheduler | Responsabilidade Principal |
|-----|-----------|----------------------------|
| `PaymentExpirationJob` | A cada 1 minuto | Varre a tabela de pagamentos buscando status `PENDING` cuja data atual seja maior que `expiresAt`. Altera para `EXPIRED`. |
| `PaymentReleaseJob` | A cada 1 minuto | Varre pagamentos `CONFIRMED` e processa o *settlement*, os tornando disponíveis para saque ou creditando o merchant. |
| `OutboxDispatcherJob` | A cada 5-10 segs | Consome eventos pendentes da tabela de `WebhookLog` (ou fila configurada) buscando disparar payloads HTTP para a URL dos merchants. |
| `AntiFraudJob` | A cada 1 hora | Simulação de análise transacional em bloco. |
| `SettlementJob` | Diário (00:00) | Consolidação diária de balanços para transferência bancária do merchant. |
| `CleanupLogsJob` | Diário (03:00) | Rotina de deleção de logs antigos e limpezas operacionais do sistema. |

## 🔄 Fluxo de Envio de Webhooks (Outbox)

O Worker assegura garantia de entrega (At-Least-Once Delivery) nos eventos de pagamento. O fluxo funciona da seguinte forma:

1. A API cria um `Payment` e, na *mesma transação de banco de dados*, insere um registro em `WebhookLog` com status "PENDING".
2. O `OutboxDispatcherJob` pega essa linha.
3. Faz um envio HTTP assinado via HMAC-SHA256 (`X-Hockpay-Signature`).
4. Se o servidor do merchant responder `2xx`, o log é atualizado para sucesso.
5. Se não, agenda um *retry* progressivo.

### Estratégia de Retry (Retentativas)

Caso o endpoint do merchant falhe (Timeout, 5xx, ou configuração incorreta):

| Tentativa | Backoff Delay |
|-----------|---------------|
| 1ª vez | Imediata |
| 2ª vez | Após 1 minuto |
| 3ª vez | Após 5 minutos |
| 4ª vez | Após 30 minutos |
| 5ª vez (final) | Após 2 horas |

Após 5 falhas exaustivas, o envio do evento falha permanentemente e sua redelivery deve ser engatilhada manualmente via Dashboard.

## 🛠️ Variáveis de Ambiente Necessárias

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | Conexão com o PostgreSQL. |
| `REDIS_URL` | Usado para Filas do BullMQ (se a infra não usar Native SQS). |

## 💻 Comandos Locais

```bash
pnpm dev          # Roda o worker em ambiente de desenvolvimento
pnpm build        # Empacota para a pasta /dist para deploy/Docker
pnpm start:prod   # Inicia a aplicação usando arquivos cacheados do build
```

---

[⬅️ Voltar para o monorepo raiz](../../README.md)
