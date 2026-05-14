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
                loadComponent: () => import('./features/landing/pages/home/home').then(m => m.Home),
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
                loadComponent: () => import('./features/auth/pages/login/login').then(m => m.Login),
            },
            {
                path: 'register',
                loadComponent: () => import('./features/auth/pages/register/register').then(m => m.Register),
            },
        ],
    },
    {
        path: 'dashboard',
        component: DashboardLayout,
        canActivate: [authGuard],
        children: [
            {
                path: '',
                loadComponent: () => import('./features/dashboard/pages/overview/overview').then(m => m.Overview),
            },
            {
                path: 'payments',
                loadComponent: () => import('./features/dashboard/pages/payments/payments').then(m => m.Payments),
            },
            {
                path: 'payments/:id',
                loadComponent: () => import('./features/dashboard/pages/payment-detail/payment-detail').then(m => m.PaymentDetail),
            },
            {
                path: 'receipts',
                loadComponent: () => import('./features/dashboard/pages/receipts/receipts').then(m => m.Receipts),
            },
            {
                path: 'receipts/:id',
                loadComponent: () => import('./features/dashboard/pages/receipt-detail/receipt-detail').then(m => m.ReceiptDetail),
            },
            {
                path: 'customers',
                loadComponent: () => import('./features/dashboard/pages/customers/customers').then(m => m.Customers),
            },
            {
                path: 'customers/:id',
                loadComponent: () => import('./features/dashboard/pages/customer-detail/customer-detail').then(m => m.CustomerDetail),
            },
            {
                path: 'api',
                loadComponent: () => import('./features/dashboard/pages/api/api').then(m => m.Api),
            },
            {
                path: 'api-keys',
                redirectTo: 'api',
                pathMatch: 'full',
            },
            {
                path: 'webhooks',
                loadComponent: () => import('./features/dashboard/pages/webhooks/webhooks').then(m => m.Webhooks),
            },
            {
                path: 'alerts',
                loadComponent: () => import('./features/dashboard/pages/alerts/alerts').then(m => m.Alerts),
            },
            {
                path: 'products',
                loadComponent: () => import('./features/dashboard/pages/products/products').then(m => m.Products),
            },
            {
                path: 'financials',
                loadComponent: () => import('./features/dashboard/pages/financials/financials').then(m => m.Financials),
            },
            {
                path: 'settings',
                loadComponent: () => import('./features/dashboard/pages/settings/settings').then(m => m.Settings),
            }
        ],
    },
];
