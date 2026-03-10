# 💻 `@hockpay/web`

[![Angular](https://img.shields.io/badge/Angular-21+-red.svg)](https://angular.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-blue.svg)](https://tailwindcss.com/)
[![Spartan UI](https://img.shields.io/badge/Spartan_UI-Brain-black.svg)](https://www.spartan.ng/)

Aplicação front-end principal do Hockpay construída com **Angular**. Ela encapsula tanto o site público de marketing quanto a área logada do sistema.

## 🎯 Arquitetura de Features

A base de código segue uma separação estrita por módulos (features), utilizando o ecossistema reativo do Angular e TailwindCSS para estilos utilitários.

| Feature Area | Caminho | Descrição |
|--------------|---------|-----------|
| **Landing** | `src/app/features/landing` | Páginas estáticas de marketing, preços e guia ágil de API para devs interessados em integrar o Hockpay. |
| **Auth** | `src/app/features/auth` | Telas de SignIn e SignUp do merchant com formulários reativos. Comunica-se via cookies HttpOnly com a API. |
| **Dashboard** | `src/app/features/dashboard` | Área logada rica em dados para o lojista: gráficos via *ApexCharts*, listagem de pagamentos e painel e configuração de Webhooks/API Keys. |

A camada de componentes visuais brutos (`libs/`) abriga a ponte entre o design system base e a camada de Headless UI **Spartan-ng**, gerando componentes reutilizáveis, acessíveis e elegantes.

## 🎨 Integrações & Ferramentas Visuais

- **Spartan UI (Brain)**: Primitivas headless e de acessibilidade providas ao Angular, unificadas ao utilitário `CVA` (Class Variance Authority) para manter consistência das variantes Tailwind.
- **ApexCharts** (`ng-apexcharts`): Para componentes de gráficos reativos de alta performance exibidos no Dashboard.
- **Lucide Icons** (`@ng-icons/lucide`): Set padrão de ícones escaláveis integrados nativamente.
- **Tailwind v4**: Carregamento instantâneo via PostCSS e nova sintaxe para gestão de temas e cores.

## 🔌 Reatividade

Priorizamos fortemente *Control Flow* estrutural (ex: `@if`, `@for`) em detrimento de diretivas estruturais antigas. O manuseio de estado assíncrono é tratado com os novos Signals (`signal()`, `computed()`, `effect()`) aliando performance à sintaxe limpa.

## 💻 Comandos Locais

Estes comandos podem ser rodados dentro da pasta `apps/web`:

```bash
pnpm dev          # Iniciar o ng serve (localhost:4200)
pnpm build        # Build otimizado de produção
pnpm test         # Executar suíte de testes (`vitest` configurado)
```

---

[⬅️ Voltar para o monorepo raiz](../../README.md)
