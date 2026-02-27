import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * HTTP Interceptor — Handles authentication concerns at the HTTP layer ONLY.
 *
 * Responsibilities:
 * 1. Attach `withCredentials: true` to every request (sends HTTP-only cookies).
 * 2. On 401 (except refresh/login): attempt a transparent token refresh.
 * 3. On refresh failure: update auth state to `false` and propagate the error.
 *
 * This interceptor NEVER does routing (no `router.navigate`). Routing decisions
 * belong to the Guards and Components that consume the auth state.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);

    const clonedRequest = req.clone({ withCredentials: true });

    return next(clonedRequest).pipe(
        catchError((error: HttpErrorResponse) => {
            const isUnauthorized = error.status === 401;
            const isAuthRoute =
                req.url.includes('/auth/refresh') ||
                req.url.includes('/auth/login');

            if (isUnauthorized && !isAuthRoute) {
                return authService.handleTokenRefresh().pipe(
                    switchMap(() => next(clonedRequest)),
                    catchError((refreshError) => {
                        // Refresh failed — state is already set to false by handleTokenRefresh.
                        // Propagate the error so guards/components can react.
                        return throwError(() => refreshError);
                    })
                );
            }

            return throwError(() => error);
        })
    );
};
