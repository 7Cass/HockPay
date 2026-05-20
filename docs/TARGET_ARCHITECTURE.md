# Hockpay - Arquitetura Alvo

Este documento descreve direcao futura. Ele nao substitui `docs/CURRENT_STATE.md` como fonte do runtime atual.

## Principios

- Manter separacao clara entre dominio, aplicacao, adapters e delivery HTTP/UI.
- Tratar simulacao como produto explicito, sem linguagem que prometa processamento financeiro real.
- Preservar rastreabilidade operacional: `requestId`, outbox, jobs, logs e dashboard.
- Evoluir schema, core, API, worker e frontend juntos para evitar features meia-expostas.
- Documentar toda capacidade como implementada, parcial ou planejada.

## Direcoes Tecnicas

| Area | Direcao |
| --- | --- |
| Contratos HTTP | Consolidar politicas de idempotencia para mutacoes criticas e manter exemplos alinhados a `/api/v1`. |
| Dominio financeiro | Manter `Account`, `Transaction`, `Refund`, `Receipt`, `BankAccount` e `Withdrawal` coerentes entre core, Prisma, API e dashboard. |
| Outbox e webhooks | Tratar outbox como contrato interno estavel para eventos de payments, refunds, withdrawals e alerts. |
| Infra compartilhada | Reduzir duplicacao entre API/worker movendo adapters reutilizaveis para `packages/infrastructure` quando fizer sentido. |
| Frontend | Completar ou esconder telas que ainda sao placeholder; evitar prometer backend inexistente. |
| Observabilidade | Fortalecer trilhas por `requestId`, `outboxEventId`, `deliveryId`, aggregate id e status de jobs. |

## Produto Futuro

| Tema | Status alvo |
| --- | --- |
| Products/catalog | Decidir entre implementar end-to-end ou remover do escopo visivel. |
| Settings | Transformar em configuracao real ou manter como leitura limitada. |
| Withdrawals | Adicionar politicas administrativas, auditoria e modos de aprovacao quando houver necessidade. |
| Metodos de pagamento alem de Pix | Exigem desenho de simuladores proprios antes de aparecerem como prontos. |
| Marketplace/split/multi-seller | Requerem PRD, modelo financeiro e limites de produto antes da implementacao. |

## Regras Alvo

- Mutacoes financeiras devem ter politica explicita de idempotencia.
- Valores monetarios permanecem em centavos.
- Simulacao TEST deve ser ergonomica, mas separada de qualquer caminho LIVE.
- Eventos publicos devem ser versionados/documentados antes de virarem contrato externo estavel.
- CI pode ganhar lint e smokes quando os scripts forem nao-mutantes e o runner local estiver pronto para ambiente automatizado.

## Fora do Alvo Imediato

- Processamento real de Pix, cartao, boleto ou debito.
- Payout bancario real.
- Gate de CI com smokes Docker enquanto API/worker/checkout ainda rodam como processos Node no host.
- Marketplace/split/multi-seller sem PRD dedicado.

