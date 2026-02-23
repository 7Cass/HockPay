# @hockpay/api

[![NestJS](https://img.shields.io/badge/NestJS-11-red.svg)](https://nestjs.com/)

API REST principal do Hockpay. Responsável por expor endpoints de pagamentos, webhooks e autenticação.

## Módulos

| Módulo | Descrição |
|--------|-----------|
| `auth` | Login, logout, refresh token |
| `merchant` | Gestão de contas |
| `store` | Gestão de lojas |
| `api-key` | Gestão de API keys |
| `customer` | Gestão de clientes |
| `payment` | Criação e consulta de pagamentos |
| `webhook` | Configuração de webhooks |
| `idempotency` | Cache de requisições idempotentes |

## Endpoints Principais

### Autenticação

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/auth/login` | Login do merchant |
| `POST` | `/auth/refresh` | Renovar access token |
| `POST` | `/auth/logout` | Logout |

### Pagamentos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/v1/payments` | Criar pagamento |
| `GET` | `/v1/payments` | Listar pagamentos |
| `GET` | `/v1/payments/:id` | Buscar pagamento |

### Desenvolvimento (test keys only)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/v1/dev/simulate/:id/confirm` | Confirmar pagamento |
| `POST` | `/v1/dev/simulate/:id/expire` | Expirar pagamento |
| `POST` | `/v1/dev/simulate/:id/fail` | Falhar pagamento |

## Autenticação

### API Pública (API Keys)

```bash
curl -H "Authorization: Bearer hk_test_xxx" http://localhost:3000/v1/payments
```

- **Formato:** `hk_{environment}_{32_chars}`
- **Ambientes:** `test` (simulações) ou `live`

### Dashboard (JWT)

- Access Token: 15 minutos (cookie HttpOnly)
- Refresh Token: 7 dias (cookie HttpOnly)

## Exemplos curl

### Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "merchant@email.com",
    "password": "senha123"
  }'
```

### Criar Pagamento

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

### Simular Confirmação

```bash
curl -X POST http://localhost:3000/v1/dev/simulate/{payment_id}/confirm \
  -H "Authorization: Bearer hk_test_xxx"
```

## Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | Conexão PostgreSQL |
| `REDIS_URL` | Conexão Redis |
| `JWT_SECRET` | Secret para JWT |
| `ENCRYPTION_KEY` | Chave AES-256 para criptografia |

## Scripts

```bash
pnpm dev          # Desenvolvimento (watch)
pnpm build        # Build de produção
pnpm start:prod   # Iniciar produção
pnpm test         # Testes unitários
pnpm test:e2e     # Testes E2E
```

## Dependências Internas

- `@hockpay/core` - Use cases e entidades
- `@hockpay/infrastructure` - Implementações de repositories
- `@hockpay/database` - Prisma client

---

[Voltar para README principal](../../README.md)
