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
                path: 'customers',
                loadComponent: () => import('./features/dashboard/pages/customers/customers').then(m => m.Customers),
            },
            {
                path: 'api-keys',
                loadComponent: () => import('./features/dashboard/pages/api-keys/api-keys').then(m => m.ApiKeys),
            },
            {
                path: 'webhooks',
                loadComponent: () => import('./features/dashboard/pages/webhooks/webhooks').then(m => m.Webhooks),
            },
            {
                path: 'stores',
                loadComponent: () => import('./features/dashboard/pages/stores/stores').then(m => m.Stores),
            },
            {
                path: 'settings',
                loadComponent: () => import('./features/dashboard/pages/settings/settings').then(m => m.Settings),
            }
        ],
    },
];
