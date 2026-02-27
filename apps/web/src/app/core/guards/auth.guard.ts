import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Guard that protects private routes (e.g., /dashboard).
 *
 * Reads the centralized auth state from AuthService:
 * - `true`  → allow access immediately (no API call)
 * - `false` → redirect to /login immediately (no API call)
 * - `null`  → first load, call checkAuthStatus() to verify with the server
 */
export const authGuard: CanActivateFn = () => {
    const router = inject(Router);
    const authService = inject(AuthService);

    const state = authService.isAuthenticated();

    if (state === true) {
        return true;
    }

    if (state === false) {
        return router.createUrlTree(['/login']);
    }

    // Unknown state — verify with the server
    return authService.checkAuthStatus().pipe(
        map((isAuthenticated) =>
            isAuthenticated ? true : router.createUrlTree(['/login'])
        )
    );
};
