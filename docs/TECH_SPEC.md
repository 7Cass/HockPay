# Hockpay - Tech Spec & AI Context PRD

> ⚠️ **INSTRUÇÃO PARA AGENTES CLAUDE/GEMINI/OPENAI:** 
> Este documento constitui a Fonte Primária da Verdade (Source of Truth) para geração de código do sistema Hockpay. Siga estritamente as restrições abaixo em atividades de *Vibe Coding* ou *Pair Programming*. Em caso de conflito, a regra descrita aqui tem precedência absoluta.

---

## 1. Stack Tecnológica Rigorosa

**Permitidas e Obrigatórias:**
*   **Monorepo:** Turborepo gerenciado via `pnpm` workspaces (v9+).
*   **Backend (API & Worker):** NestJS v11+, aderindo rigidamente à Clean Architecture (Domain, Application, Infrastructure, Presentation).
*   **Frontend Principal (Dashboard / Landing):** Angular v21+ utilizando Zonaeless (`provideZonelessChangeDetection`), Signals puros (`signal`, `computed`, `effect`) e *Spartan UI* (Headless + Tailwind v4).
*   **Frontend Secundário (Checkout):** Next.js 14+ (App Router) estritamente para a página de checkout white-label.
*   **Banco de Dados & ORM:** PostgreSQL v15+ gerenciado exclusivamente via Prisma ORM v6+.
*   **Filas e Cache:** Redis v7+ (via BullMQ no NestJS para outbox de webhooks).
*   **Estilos:** Tailwind CSS v4 para Angular e v3.4 para Next.js.

**Proibidas (NÃO USAR em hipótese alguma):**
*   ❌ Express/Fastify "puros" fora da abstração do NestJS.
*   ❌ Moment.js ou bibliotecas pesadas de data (Use `date-fns` ou objetos `Date` nativos do JS/TS).
*   ❌ RxJS no Angular para estado local de componentes (Use SOMENTE Signals; RxJS é tolerado apenas em serviços HttpClient).
*   ❌ CSS Modules ou pré-processadores (SASS/LESS). Estilização 100% via Tailwind classes.
*   ❌ Acoplamento de Prisma Client dentro da pasta `packages/core/src/domain`.

---

## 2. Modelagem de Entidades Central

A aplicação fundamenta-se nas seguintes entidades core, que devem ser puras no Domínio e espelhadas no Prisma:

1.  **Merchant (Lojista)**
    *   **Propriedades Core:** `id` (UUID), `email` (string/unique), `name` (string), `document` (CNPJ/CPF), `isActive` (boolean).
    *   **Relações:** Possui (1:N) `ApiKeys`, (1:N) `Payments`, e (1:N) `WebhookConfigs`.
2.  **Payment (Pagamento Pix)**
    *   **Propriedades Core:** `id` (UUID), `amount` (int: armazenado em centavos para evitar flutuação), `status` (Enum: `PENDING`, `CONFIRMED`, `EXPIRED`, `FAILED`), `expiresAt` (Date).
    *   **Relações:** Pertence a (N:1) um `Merchant`. Possui (1:N) `WebhookLogs` (Tentativas de envio).
3.  **WebhookConfig & WebhookLog (Sistema Outbox)**
    *   **WebhookConfig:** Determina a `url` de destino e o `secret` de assinatura assíncrona pertencente ao Merchant.
    *   **WebhookLog:** Trilha de auditoria por pagamento. Tem `payload` (JSON), `attempt` (int), `responseStatus` (HTTP Code recebido) e `nextRetryAt` (Date).

---

## 3. Contratos e Regras de Negócio Duras (Inflexíveis)

Ao gerar casos de uso (`packages/core/src/application/use-cases/`), garanta que os testes unitários e o código final implementem as seguintes travas de segurança:

1.  **Idempotência Obrigatória:** Qualquer rota de mutação (POST/PUT/PATCH) e especificamente a de "Criar Pagamento" deve exigir um header `Idempotency-Key` válido. Chaves repetidas nas últimas 24 horas devem retornar o *exato mesmo JSON HTTP 200/201 (cached response)* da primeira chamada bem sucedida, sem regerar dados ou cobrar o DB.
2.  **Transição de Status de Pagamento (FSM):** Um pagamento só pode transitar de `PENDING` para `CONFIRMED`, `EXPIRED` ou `FAILED`. Se ele já estiver num estado final, qualquer tentativa de confirmação lançará a exceção `InvalidStatusTransitionError`.
3.  **Valores Financeiros (Cents Rule):** A entidade local `Money` é obrigatória no Domínio. Nunca realize matemática de moeda com primitivos float diretamente. Valores devem sempre trafegar como inteiros (`amount: 1500` = R$15,00). 
4.  **Assinatura de Webhooks Obrigatória:** Ao serializar o disparo do webhook (no Worker Post-Hook), crie um hash HMAC-SHA256 usando o payload e o `secret` da WebhookConfig do respectivo Merchant e insira o hash final em um Header específico (`Hockpay-Signature: v1=XXXXXXX`). 

---

## 4. Fluxos e Padrões de UI/UX Essenciais (Dashboard Angular)

*   **Layout:** Layout "Dashboard Genérico SaaS" com *Sidebar* escura fixa à esquerda contendo ícones de navegação ("Resumo", "Pagamentos", "Webhooks", "API Keys").
*   **Gerenciamento de Estado (Sinais):** Use a injeção funcional do Angular (ex: `paymentService = inject(PaymentService)`) associada a Signals (ex: `payments = signal<Payment[]>([])`).
*   **Carregamento e Interatividade:** O bloqueio da Thread principal durante requisições de rede com Spinners globais é proibido. Use `Skeleton Loaders` nos blocos de conteúdo da Tabela de Pagamentos enquanto os sinais emuem requisições ativas. Padrão visual suportado via `hlm-skeleton` do Spartan UI.
*   **Diálogos e Modais:** Refações ou confirmações sensíveis (como "Revogar Chave de API" ou "Reenviar Webhook") devem invocar `hlm-alert-dialog` forçando interação em *two-steps* para evitar acidentes.

