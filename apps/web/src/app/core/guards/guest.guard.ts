import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Guard that prevents authenticated users from accessing auth routes (login, register).
 *
 * Reads the centralized auth state from AuthService:
 * - `true`  → redirect to /dashboard immediately (no API call)
 * - `false` → allow access immediately (no API call)
 * - `null`  → first load, call checkAuthStatus() to verify with the server
 */
export const guestGuard: CanActivateFn = () => {
    const router = inject(Router);
    const authService = inject(AuthService);

    const state = authService.isAuthenticated();

    if (state === true) {
        return router.createUrlTree(['/dashboard']);
    }

    if (state === false) {
        return true;
    }

    // Unknown state — verify with the server
    return authService.checkAuthStatus().pipe(
        map((isAuthenticated) =>
            isAuthenticated ? router.createUrlTree(['/dashboard']) : true
        )
    );
};
