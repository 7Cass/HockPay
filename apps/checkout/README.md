# 🛒 `@hockpay/checkout`

[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v3.4-38B2AC.svg)](https://tailwindcss.com/)

O `checkout` é a aplicação orientada ao cliente final (comprador). Diferente do dashboard interno que utiliza Angular, o Checkout é uma aplicação **Next.js 14** construída puramente focada em performance, conversão e white-label (personalização por merchant).

> O checkout opera num ambiente tático: sua meta é renderizar um QR Code Pix ou código "Copia e Cola" o mais rápido possível e escutar eventos de mudança de status (`CONFIRMED`, `EXPIRED`).

## 🎯 Arquitetura de UI

Foi projetado utilizando React Server Components e Client Components com o Tailwind CSS como motor visual, além do uso proeminente da biblioteca `lucide-react` para iconografia sem comprometer bundle size.  

Diferenciais da arquitetura:
1. **Isolamento**: Completamente desacomplado do Dashboard.
2. **Performance (SSR/SSG)**: Telas de checkout abrem instantaneamente.
3. **Polling/Sincronização**: Componentes client-side inspecionam a API para atualizar a UI em tempo real quando um pagamento Pix é efetivado.

## 🔌 Integração com API

O checkout consulta a rota da API pública (normalmente em `http://localhost:3000/v1/payments/:id`) para montar a tela.

## 💻 Comandos Locais

```bash
# Iniciar ambiente de desenvolvimento (porta 3333 por padrão)
pnpm dev

# Gerar bundle otimizado para produção
pnpm build

# Start server com a build gerada
pnpm start

# Analisar e corrigir formatação padrão
pnpm lint
```

---

[⬅️ Voltar para o monorepo raiz](../../README.md)
