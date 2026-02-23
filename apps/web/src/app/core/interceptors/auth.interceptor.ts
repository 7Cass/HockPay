import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { HttpClient } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const router = inject(Router);
    const http = inject(HttpClient);

    // Clone to attach withCredentials
    const clonedRequest = req.clone({
        withCredentials: true
    });

    return next(clonedRequest).pipe(
        catchError((error: HttpErrorResponse) => {
            // If error is 401 and we aren't already refreshing/logging in
            if (error.status === 401 && !req.url.includes('/auth/refresh') && !req.url.includes('/auth/login')) {

                // Attempt to refresh token using the HttpOnly cookie
                return http.post('/api/v1/auth/refresh', {}, { withCredentials: true }).pipe(
                    switchMap(() => {
                        // If successful, retry the original request
                        return next(clonedRequest);
                    }),
                    catchError((refreshError) => {
                        // If refresh fails, redirect to login
                        router.navigate(['/login']);
                        return throwError(() => refreshError);
                    })
                );
            }

            // Pass other errors forward
            return throwError(() => error);
        })
    );
};
