import type { Routes } from '@angular/router';

import { operatorGuard, operatorGuestGuard } from './guards/operator.guard';
import { AdminShell } from './layouts/admin-shell/admin-shell';

/**
 * As rotas do admin, num arquivo só.
 *
 * Elas moram aqui e não em `app.routes.ts` pela mesma razão que o resto da
 * pasta: quando o admin virar `apps/admin`, este arquivo é o `app.routes.ts`
 * dele — sem o prefixo `/operator`, que só existe porque hoje as duas
 * superfícies dividem uma origem.
 *
 * O prefixo, aliás, é o do domínio e não o da superfície: quem trabalha aqui é
 * um `Operator`, que é tabela própria no backend e cookie com path próprio
 * (`/api/v1/operator`). A pasta se chama `admin` porque é o nome do produto
 * interno; a rota se chama `operator` porque é o nome de quem entra.
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: 'login',
    canActivate: [operatorGuestGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.OperatorLogin),
  },
  {
    path: '',
    component: AdminShell,
    canActivate: [operatorGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/queue/queue').then((m) => m.OperatorQueue),
      },
      {
        path: 'audit-logs',
        loadComponent: () =>
          import('./pages/audit-log/audit-log').then((m) => m.OperatorAuditLogPage),
      },
      {
        path: 'stores/:id',
        loadComponent: () =>
          import('./pages/store-detail/store-detail').then((m) => m.OperatorStoreDetail),
      },
    ],
  },
];
