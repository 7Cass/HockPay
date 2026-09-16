import { Routes } from '@angular/router';
import { PublicLayout } from './shared/layouts/public-layout/public-layout';
import { DashboardLayout } from './shared/layouts/dashboard-layout/dashboard-layout';
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
  {
    path: 'dashboard',
    component: DashboardLayout,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/dashboard/pages/overview/overview').then((m) => m.Overview),
      },
      {
        path: 'payment-links',
        loadComponent: () =>
          import('./features/dashboard/pages/payment-links/payment-links').then(
            (m) => m.PaymentLinks,
          ),
      },
      {
        path: 'payment-links/:id',
        loadComponent: () =>
          import('./features/dashboard/pages/payment-link-detail/payment-link-detail').then(
            (m) => m.PaymentLinkDetail,
          ),
      },
      {
        path: 'payments/:id',
        loadComponent: () =>
          import('./features/dashboard/pages/payment-detail/payment-detail').then(
            (m) => m.PaymentDetail,
          ),
      },
      {
        path: 'receipts/:id',
        loadComponent: () =>
          import('./features/dashboard/pages/receipt-detail/receipt-detail').then(
            (m) => m.ReceiptDetail,
          ),
      },
      {
        path: 'customers/:id',
        loadComponent: () =>
          import('./features/dashboard/pages/customer-detail/customer-detail').then(
            (m) => m.CustomerDetail,
          ),
      },
      {
        path: 'api',
        loadComponent: () => import('./features/dashboard/pages/api/api').then((m) => m.Api),
      },
      {
        path: 'api-keys',
        redirectTo: 'api',
        pathMatch: 'full',
      },
      {
        path: 'webhooks',
        loadComponent: () =>
          import('./features/dashboard/pages/webhooks/webhooks').then((m) => m.Webhooks),
      },
      {
        path: 'alerts',
        loadComponent: () =>
          import('./features/dashboard/pages/alerts/alerts').then((m) => m.Alerts),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/dashboard/pages/products/products').then((m) => m.Products),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/dashboard/pages/settings/settings').then((m) => m.Settings),
      },
    ],
  },
  // ─── Console do lojista ─────────────────────────────────────────────
  // A migração é tela a tela, e as duas cascas convivem no mesmo prefixo.
  //
  // A ordem é deliberada: a entrada antiga vem primeiro e continua dona de
  // `/dashboard` e de tudo que ainda não migrou. Uma tela migra **por
  // subtração** — sai da lista de filhos acima e passa a ser servida daqui,
  // porque o roteador, ao não achar o caminho entre os filhos do bloco
  // anterior, volta atrás e tenta esta entrada.
  //
  // O caminho oposto (console primeiro) tem um buraco: o `path: ''` do console
  // casaria com `/dashboard` e serviria uma casca vazia no lugar da visão
  // geral, que ainda não migrou. Foi o que aconteceu, e é por isso que está
  // assim documentado.
  //
  // A URL não muda na travessia, então nenhum link guardado quebra.
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadChildren: () => import('./merchant/merchant.routes').then((m) => m.CONSOLE_ROUTES),
  },
];
