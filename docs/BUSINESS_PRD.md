# Hockpay - Business PRD (Product Requirements Document)

## 1. Visão do Produto e Problema
**Dor Central:** A integração, homologação e o entendimento técnico de fluxos de pagamento (como Pix e Webhooks assíncronos) são complexos, burocráticos e demorados. Desenvolvedores indie e pequenas startups gastam dias ou semanas lidando com credenciais de bancos reais, taxas e documentações dispersas apenas para testar um MVP ou construir uma prova de conceito (PoC).
**Público-Alvo:** Desenvolvedores de software independentes (Indie Hackers), estudantes de tecnologia e pequenas startups ("SaaS de garagem") que precisam de um gateway de pagamento rápido e 100% simulado para ambiente de teste.

## 2. Proposta de Valor e Diferenciais
**O que nos torna melhores que a concorrência?**
Não somos um gateway financeiro real e não transacionamos dinheiro, logo, não exigimos CNPJ ou KYC (Conheça seu Cliente) demorados. Nossa plataforma entrega uma experiência "plug-and-play" instantânea que emula perfeitamente o rigor técnico de gigantes como Stripe e Mercado Pago (Idempotência perfeita, webhooks com retentativas e padrões REST). É a ferramenta número 1 global para treino, homologação local e projetos de portfólio.

## 3. Métricas de Sucesso (KPIs)
Para validar se o Hockpay está cumprindo seu objetivo como ferramenta Dev-First, acompanharemos:
1. **Time-to-First-Hello-World (TTFHW):** Tempo médio desde a criação da "Account" até o disparo bem-sucedido do primeiro Webhook de "pagamento confirmado" na máquina do desenvolvedor (Meta: Menos de 10 minutos).
2. **Taxa de Retenção de API Keys (Dev Mode):** Porcentagem de devs que emitem a API Key `hk_test_` e relizam mais de 5 simulações de pagamentos num período de 7 dias, indicando uso contínuo em desenvolvimento de produto.
3. **Volume de Webhooks Disparados Diariamente:** Medidor de "Health" da engrenagem assíncrona do sistema (Workers / Retry). Indica quanto o ecossistema está sendo sobrecarregado por requisições de teste.

## 4. Visão Geral das Funcionalidades Core (MVP)
1. **Public API Engine com Simulação:** API RESTFul que permita "Criar Pagamento" (gerando Pix copiáveis fakes) e Endpoints especiais de Dev Mode (`/v1/dev/simulate`) para forçar o status de uma transação.
2. **Dashboard de Lojista Analítico e Gestor de Chaves:** Um painel web logado onde o dev consegue emitir credenciais seguras, definir URLs receptoras para o seu aplicativo local e enxergar logs do que foi trafegado e recusado.
3. **Webhook Dispatcher Confiável (Outbox):** Worker de background capaz de enfileirar eventos (`payment.created`, `payment.confirmed`) disparando payloads via HTTP POST estritamente assinados criptograficamente.
