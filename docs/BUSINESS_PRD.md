# Hockpay — Business PRD

## 1. Visão de Produto

Hockpay existe para reduzir o custo de integração e homologação de fluxos de pagamento para desenvolvedores indie, estudantes e pequenas startups. O foco é oferecer uma experiência de gateway simulado com rigor técnico suficiente para treinar integrações reais: pagamentos Pix simulados, webhooks, idempotência e fluxos de checkout.

## 2. Proposta de Valor

- integração rápida em ambiente local
- API simples para testes e protótipos
- checkout hospedado para demonstrações
- webhooks assinados e fluxo assíncrono verificável

## 3. Funcionalidades-Alvo do Produto

1. API pública para criar e consultar pagamentos
2. Dashboard do merchant para acompanhar transações e configurações
3. Checkout hospedado para o comprador
4. Entrega assíncrona confiável de webhooks
5. Fluxos de dev mode para simulação e demonstração

## 4. Cobertura Atual do MVP

| Capacidade                          | Status Atual           | Observações                                                              |
| ----------------------------------- | ---------------------- | ------------------------------------------------------------------------ |
| Criar pagamento Pix simulado        | Implementado           | Via `/api/v1/payments`                                                   |
| Simular confirmação/falha/expiração | Implementado           | Via `dev/simulate` e endpoint usado pelo checkout                        |
| Dashboard Angular                   | Implementado           | Landing + auth + dashboard em `apps/web`                                 |
| Checkout hospedado                  | Implementado           | Baseado em `checkout session`                                            |
| Webhooks com assinatura             | Implementado           | Outbox + BullMQ + HMAC                                                   |
| API keys por ambiente               | Implementado           | Fluxo público atual                                                      |
| Catálogo de produtos                | Parcial                | Schema existe; UI placeholder existe; backend não está completo          |
| Saques / withdrawals                | Implementado API-first | API, ledger, worker simulado e webhooks; dashboard fica fora desta etapa |

## 5. Indicadores de Sucesso

- tempo até primeiro pagamento/teste bem-sucedido
- tempo até primeiro webhook recebido
- uso recorrente de API keys de teste
- volume diário de webhooks e pagamentos simulados

## 6. Observação Importante

Este PRD continua sendo um documento de produto e direção. Para o que o código implementa hoje, use a documentação current-state do repositório.
