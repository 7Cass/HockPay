# 🚀 `@hockpay/api`

[![NestJS](https://img.shields.io/badge/NestJS-11-red.svg)](https://nestjs.com/)

API REST principal do **Hockpay**. Ela atua como a camada de *Presentation* e um *API Gateway*, expondo os endpoints essenciais para merchants manipularem pagamentos, webhooks e integrações. A API confia a lógica de negócios pesada aos pacotes `@hockpay/core` (Domain/Application) e delega a comunicação de dados ao `@hockpay/infrastructure`.

## 📂 Arquitetura e Módulos

Esta aplicação usa o ecossistema NestJS, organizando-se em módulos coesos que representam os diferentes domínios e contextos do negócio.

| Módulo | Descrição |
|--------|-----------|
| `account` | Gestão de saldos virtuais das lojas associadas ao merchant. |
| `api-key` | Emissão e validação de chaves de acesso públicas (API Keys). |
| `auth` | Sistema de login interno, logout e refresh tokens (Dashboard). |
| `bank-account` | Gestão de contas bancárias reais para transferência de fundos. |
| `customer` | Gestão de perfis de clientes finais (compradores). |
| `dashboard` | Consolidação de métricas e gráficos de faturamento para o painel. |
| `idempotency` | Middleware de cache para requisições idempotentes (header `Idempotency-Key`). |
| `merchant` | Criação e gestão de contas de merchants. |
| `payment` | Núcleo do produto: criação, aprovação (dev mode) e consulta de pagamentos Pix. |
| `store` | Gerenciamento de lojas sob o guarda-chuva de um merchant. |
| `transaction` | Extrato histórico e movimentações financeiras da respectiva conta (`account`). |
| `webhook` | Configuração de URLs e gestão de assinatura e envio de eventos (`outbox pattern`). |

## 🛡️ Camada de Autenticação

O sistema opera sob dois paradigmas distintos de autenticação para suprir o Dashboard de controle e a API Pública:

### 1. API Pública (Autenticação via API Key)
Para integrações de backend-para-backend dos devs indie:
- **Formato esperado**: Inserir no header da requisição, ex: `Authorization: Bearer hk_test_xxx` ou `hk_live_xxx`.
- **Validação Segura**: Apenas o Hash `SHA-256` da key é mantido no banco de dados.

### 2. Dashboard (Autenticação via JWT)
Para controle de sessão dos próprios merchants usando a UI:
- **Formato**: Uso de cookies com diretiva `HttpOnly`.
- **Tempos de expiração**: Access Token expira em 15 minutos; Refresh Token dura 7 dias.

## 🔌 Referência Rápida de Endpoints

### Criação de Pagamento (Pública)
```bash
curl -X POST http://localhost:3000/v1/payments \
  -H "Authorization: Bearer hk_test_xxx" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: pedido-123" \
  -d '{
    "amount": 1500,
    "customer": {
      "name": "João Silva",
      "email": "joao@email.com",
      "document": "12345678900"
    }
  }'
```

### Simular Pagamento: Dev Mode (Pública)
Para os fluxos em simulação quando a chave for ambiente `test`:
```bash
# Confirma o recebimento de um PIX
curl -X POST http://localhost:3000/v1/dev/simulate/{payment_id}/confirm \
  -H "Authorization: Bearer hk_test_xxx"

# Força o status para falha
curl -X POST http://localhost:3000/v1/dev/simulate/{payment_id}/fail \
  -H "Authorization: Bearer hk_test_xxx"
```

### Módulo de Login (Dashboard Interno)
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "merchant@email.com",
    "password": "senha123"
  }'
```

## ⚙️ Variáveis de Ambiente Necessárias

| Variável | Contexto | Exemplo |
|----------|----------|---------|
| `JWT_SECRET` | Chave simétrica para assinatura do token de sessão | `super-secret` |
| `ENCRYPTION_KEY` | Chave AES-256 para dados sensíveis | `32-chars-long...` |

> *A conexão de BD e REDIS é puxada do pacote `@hockpay/config` por ser comum ao workspace.*

## 💻 Comandos Locais

Estes comandos podem ser rodados dentro da pasta `apps/api`:

```bash
pnpm dev          # Iniciar o NestJS em modo watch
pnpm build        # Gerar a de produção em dist/
pnpm test         # Executar suíte de testes unitários (Vitest/Jest)
pnpm test:e2e     # Executar suíte de testes de ponta-a-ponta
```

---

[⬅️ Voltar para o monorepo raiz](../../README.md)
