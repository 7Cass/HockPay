import { Routes } from '@angular/router';
import { PublicLayout } from './shared/layouts/public-layout/public-layout';
import { DashboardLayout } from './shared/layouts/dashboard-layout/dashboard-layout';

export const routes: Routes = [
    {
        path: '',
        component: PublicLayout,
        children: [
            {
                path: '',
                loadComponent: () => import('./features/landing/pages/home/home').then(m => m.Home),
            },
            {
                path: 'login',
                loadComponent: () => import('./features/auth/pages/login/login').then(m => m.Login),
            },
        ],
    },
    {
        path: 'dashboard',
        component: DashboardLayout,
        children: [
            {
                path: '',
                loadComponent: () => import('./features/dashboard/pages/overview/overview').then(m => m.Overview),
            }
        ],
    },
];
