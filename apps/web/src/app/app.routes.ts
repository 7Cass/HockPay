import { Routes } from '@angular/router';
import { PublicLayout } from './shared/layouts/public-layout/public-layout';
import { AuthLayout } from './shared/layouts/auth-layout/auth-layout';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: '',
    component: PublicLayout,
    children: [
      {
        path: '',
        loadComponent: () => import('./features/landing/pages/home/home').then((m) => m.Home),
      },
    ],
  },
  {
    path: '',
    component: AuthLayout,
    canActivate: [guestGuard],
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/pages/login/login').then((m) => m.Login),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./features/auth/pages/register/register').then((m) => m.Register),
      },
    ],
  },
  // ─── Admin ──────────────────────────────────────────────────────────
  // Fora do dashboard de propósito: outra sessão, outro guard, outra casca.
  // Os cookies já têm paths próprios no backend, então as duas convivem no
  // mesmo browser sem que uma saiba da outra.
  //
  // Um `loadChildren` e não rotas soltas: assim nada do admin entra no bundle
  // de quem só abre o painel do lojista, e a fronteira da pasta `admin/`
  // também é a fronteira do que se baixa.
  {
    path: 'operator',
    loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  // ─── Console do lojista ─────────────────────────────────────────────
  // A migração é tela a tela, e as duas cascas convivem no mesmo prefixo
  // `/dashboard`. A URL não muda na travessia, então nenhum link guardado
  // quebra.
  //
  // **O console vem primeiro, e a ordem só passou a poder ser esta depois que a
  // visão geral migrou.** O roteador trata os dois casos de forma diferente, e
  // os dois foram medidos aqui em `2026-09-16`:
  //
  // - **com segmento sobrando** (`/dashboard/products`): nenhum filho do
  //   console casa `products`, a rota inteira falha e o roteador **volta
  //   atrás** e tenta a entrada seguinte. É isto que faz a migração por
  //   subtração funcionar: uma tela migra saindo da lista de baixo.
  // - **sem segmento sobrando** (`/dashboard`): o pai casa por prefixo e a rota
  //   é dada como casada mesmo que nenhum filho case `''` — **não há volta
  //   atrás**. Quem tiver o `path: ''` primeiro ganha `/dashboard`, e o outro
  //   renderiza a própria casca com o outlet vazio.
  //
  // Foi exatamente esse segundo caso que quebrou a tela duas vezes: primeiro
  // com o console à frente servindo casca vazia enquanto a visão geral ainda
  // era da casa antiga, e depois com a casa antiga à frente servindo casca
  // vazia depois que a visão geral saiu dela. A regra que sobra é simples:
  // **o bloco que tem o `path: ''` da vez é o que vem primeiro.**
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadChildren: () => import('./merchant/merchant.routes').then((m) => m.CONSOLE_ROUTES),
  },
];
