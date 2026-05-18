# Hockpay — Technical Spec Alvo

> Este documento descreve a arquitetura e as regras alvo do sistema. Ele não é a descrição canônica do runtime atual.
>
> Para comportamento implementado hoje, use:
>
> - `README.md`
> - `TECHNICAL_OVERVIEW.md`
> - `DATA_MODELING.md`
> - `docs/CURRENT_STATE_AUDIT.md`

## 1. Stack Alvo

| Tema               | Alvo                                                           | Status Atual                 |
| ------------------ | -------------------------------------------------------------- | ---------------------------- |
| Monorepo           | Turborepo + `pnpm`                                             | Implementado                 |
| Backend            | NestJS com separação forte entre domínio, aplicação e adapters | Parcialmente implementado    |
| Frontend principal | Angular zoneless + signals + Spartan UI                        | Implementado em grande parte |
| Checkout           | Next.js App Router                                             | Implementado                 |
| Banco              | PostgreSQL + Prisma                                            | Implementado                 |
| Filas              | BullMQ/Redis como baseline atual                               | Implementado                 |

## 2. Regras Alvo

### 2.1 Idempotência obrigatória para mutações críticas

Alvo:

- toda mutação crítica deve ter política explícita de idempotência
- criação de pagamento deve continuar obrigatória com `Idempotency-Key`
- criação de saque deve exigir `Idempotency-Key`

Status atual:

- `Create Payment` implementa idempotência
- `Create Withdrawal` implementa idempotência obrigatória
- outras mutações ainda não seguem uma política uniforme

### 2.2 Máquina de estados de pagamentos

Alvo:

- transições devem ser restritas e explicitamente validadas no domínio

Status atual:

- já existe validação de transição e estados no domínio
- o conjunto real de estados inclui `RELEASED` e `REFUNDED`, além dos estados básicos

### 2.3 Dinheiro tratado com centavos

Alvo:

- toda regra financeira deve trabalhar com centavos
- value objects podem encapsular operações quando isso trouxer clareza

Status atual:

- o repositório usa inteiros em centavos
- existe `Money` no `core`
- nem todos os fluxos usam `Money` como tipo central do aggregate

### 2.4 Webhooks assinados

Alvo:

- webhook assinado criptograficamente, com contrato público estável

Status atual:

- implementado com HMAC
- header atual é `X-Hockpay-Signature`
- timestamp e id do webhook também são enviados

## 3. Arquitetura Alvo

### 3.1 Direção desejada

- reduzir divergência entre schema e runtime
- reduzir infra duplicada espalhada entre `apps/api`, `apps/worker` e `packages/infrastructure`
- manter docs e código em sincronia com separação formal entre `atual` e `alvo`

### 3.2 Áreas alvo

| Área             | Alvo                                                                   |
| ---------------- | ---------------------------------------------------------------------- |
| Payments         | contrato estável e bem documentado, incluindo idempotência e lifecycle |
| Webhooks         | pipeline resiliente com contrato público claro                         |
| Products/Catalog | decidir entre implementação real ou remoção do escopo visível          |
| Financeiro       | alinhar `Account`, `Transaction`, `Refund`, `Receipt` e `Withdrawal`   |
| Frontend         | evitar telas placeholder sem backend consolidado                       |

## 4. Restrições de Evolução

- nenhum documento deve se apresentar como “source of truth atual” se estiver descrevendo estado alvo
- toda nova capacidade arquitetural deve ser rotulada como:
  - `implementada`
  - `parcial`
  - `planejada`
- mudanças de arquitetura, schema ou endpoints devem atualizar a documentação canônica do estado atual
