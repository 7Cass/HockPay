import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { OperatorAuthService } from '../../admin/services/operator-auth.service';

/**
 * HTTP Interceptor — Handles authentication concerns at the HTTP LAYER ONLY.
 *
 * Responsibilities:
 * 1. Attach `withCredentials: true` to every request (sends HTTP-only cookies).
 * 2. On 401 (except refresh/login): attempt a transparent token refresh, with
 *    the session that owns the route — merchant or operator, never crossed.
 * 3. On refresh failure: update that session's state and propagate the error.
 *
 * This interceptor NEVER does routing (no `router.navigate`). Routing decisions
 * belong to the Guards and Components that consume the auth state.
 *
 * The two sessions coexist in one browser, so the branch below is a routing
 * decision about *which* session is being renewed, not a shared session with a
 * flag: a 401 on `/operator/...` must never renew — nor invalidate — the
 * merchant's, and the reverse holds just as strictly.
 *
 * This is the one place outside `admin/` that imports from it, and it is on
 * purpose: knowing about both sessions is this file's entire job. It is also
 * the reason the split into `apps/admin` gets a *second* interceptor rather
 * than a shared one — with one session per app, the branch below disappears
 * instead of being copied.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);
    const operatorAuthService = inject(OperatorAuthService);

    const clonedRequest = req.clone({ withCredentials: true });
    const isOperatorRoute = isOperatorSurface(req.url);

    return next(clonedRequest).pipe(
        catchError((error: HttpErrorResponse) => {
            const isUnauthorized = error.status === 401;
            const isAuthRoute =
                req.url.includes('/auth/refresh') ||
                req.url.includes('/auth/login');

            if (isUnauthorized && !isAuthRoute) {
                const session = isOperatorRoute ? operatorAuthService : authService;

                return session.handleTokenRefresh().pipe(
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

/**
 * Whether the URL belongs to the operator surface.
 *
 * Matched on the path segment, not on a substring: a merchant route whose id
 * or query happened to spell "operator" is not the desk.
 */
function isOperatorSurface(url: string): boolean {
    const path = url.split('?')[0];
    return /(^|\/)operator(\/|$)/.test(path);
}
