import type { Routes } from '@angular/router';

import { ConsoleShell } from './shell/console-shell';

/**
 * As rotas do console, num arquivo só.
 *
 * Elas moram aqui pela mesma razão que o resto da pasta: no dia em que o
 * console virar `apps/merchant`, este arquivo é o `app.routes.ts` dele.
 *
 * **A migração é tela a tela, e as duas cascas convivem.** Enquanto uma tela
 * não migrou, ela continua sendo servida pelo `DashboardLayout` antigo, no
 * mesmo prefixo `/dashboard`. O roteador tenta esta configuração primeiro;
 * quando o caminho não é de nenhuma tela daqui, ele segue para a entrada
 * seguinte do `app.routes.ts`. A URL não muda em nenhum dos dois casos — o
 * lojista não descobre a travessia pela barra de endereço, e nenhum link
 * guardado quebra.
 */
export const CONSOLE_ROUTES: Routes = [
  {
    path: '',
    component: ConsoleShell,
    children: [
      {
        path: 'payments',
        loadComponent: () => import('./pages/payments/payments').then((m) => m.ConsolePayments),
      },
      {
        path: 'receipts',
        loadComponent: () => import('./pages/receipts/receipts').then((m) => m.ConsoleReceipts),
      },
      {
        path: 'customers',
        loadComponent: () => import('./pages/customers/customers').then((m) => m.ConsoleCustomers),
      },
      {
        path: 'payments/:id',
        loadComponent: () =>
          import('./pages/payment-detail/payment-detail').then((m) => m.ConsolePaymentDetail),
      },
      {
        path: 'payment-links',
        loadComponent: () =>
          import('./pages/payment-links/payment-links').then((m) => m.ConsolePaymentLinks),
      },
      {
        path: 'payment-links/:id',
        loadComponent: () =>
          import('./pages/payment-link-detail/payment-link-detail').then(
            (m) => m.ConsolePaymentLinkDetail,
          ),
      },
      {
        path: 'financials',
        loadComponent: () =>
          import('./pages/financials/financials').then((m) => m.ConsoleFinancials),
      },
      {
        path: 'withdrawals',
        loadComponent: () =>
          import('./pages/withdrawals/withdrawals').then((m) => m.ConsoleWithdrawals),
      },
      {
        path: 'withdrawals/:id',
        loadComponent: () =>
          import('./pages/withdrawal-detail/withdrawal-detail').then(
            (m) => m.ConsoleWithdrawalDetail,
          ),
      },
      {
        path: 'api',
        loadComponent: () => import('./pages/api/api').then((m) => m.ConsoleApi),
      },
      {
        // O endereço antigo da tela de chaves, que ainda circula em link salvo.
        path: 'api-keys',
        redirectTo: 'api',
        pathMatch: 'full',
      },
      {
        path: 'webhooks',
        loadComponent: () => import('./pages/webhooks/webhooks').then((m) => m.ConsoleWebhooks),
      },
      {
        path: 'alerts',
        loadComponent: () => import('./pages/alerts/alerts').then((m) => m.ConsoleAlerts),
      },
    ],
  },
];
