import { inject, Injectable, signal } from '@angular/core';
import { ApiClientService } from './api-client.service';
import {
    catchError,
    finalize,
    map,
    Observable,
    of,
    shareReplay,
    switchMap,
    tap,
    throwError,
} from 'rxjs';

export interface LoginDto {
    email: string;
    password?: string;
}

export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    merchant: {
        id: string;
        email: string;
        name: string;
        document: string;
        formattedDocument: string;
        documentType: 'CPF' | 'CNPJ';
    };
}

export interface CurrentUser {
    id: string;
    name: string;
    email: string;
    document: string;
    formattedDocument: string;
    documentType: 'CPF' | 'CNPJ';
    isActive: boolean;
    createdAt: string;
    currentStoreId?: string;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private readonly api = inject(ApiClientService);

    /**
     * Centralized authentication state.
     * - `null`  → unknown (first load, page refresh — needs server check)
     * - `true`  → authenticated
     * - `false` → not authenticated
     */
    readonly isAuthenticated = signal<boolean | null>(null);

    /**
     * Current authenticated user profile.
     * Populated on login (from response) and on page refresh (from /merchants/me).
     */
    readonly currentUser = signal<CurrentUser | null>(null);

    /** Shared in-flight refresh request for concurrent 401 responses. */
    private refreshRequest$: Observable<unknown> | null = null;

    /**
     * Authenticates the merchant with email and password.
     * Populates currentUser with the data from the login response.
     */
    login(dto: LoginDto): Observable<LoginResponse> {
        return this.api.post<LoginResponse>('/auth/login', dto).pipe(
            switchMap((response) =>
                this.hydrateCurrentUser().pipe(map(() => response))
            )
        );
    }

    /**
     * Logs out the current merchant.
     * Clears all authentication state.
     */
    logout(): Observable<void> {
        return this.api.post<void>('/auth/logout', {}).pipe(
            tap(() => {
                this.isAuthenticated.set(false);
                this.currentUser.set(null);
            })
        );
    }

    /**
     * Coordinates a token refresh across concurrent requests.
     */
    handleTokenRefresh(): Observable<unknown> {
        if (!this.refreshRequest$) {
            this.refreshRequest$ = this.api.post('/auth/refresh', {}).pipe(
                tap(() => this.isAuthenticated.set(true)),
                catchError((err) => {
                    this.isAuthenticated.set(false);
                    this.currentUser.set(null);
                    return throwError(() => err);
                }),
                finalize(() => {
                    this.refreshRequest$ = null;
                }),
                shareReplay({ bufferSize: 1, refCount: false }),
            );
        }

        return this.refreshRequest$;
    }

    /**
     * Loads the full merchant profile and updates the auth state.
     */
    hydrateCurrentUser(): Observable<CurrentUser> {
        return this.api.get<CurrentUser>('/merchants/me').pipe(
            tap((user) => {
                this.isAuthenticated.set(true);
                this.currentUser.set(user);
            })
        );
    }

    /**
     * Checks if the user is authenticated.
     *
     * Uses GET /merchants/me to both verify auth status AND hydrate user data.
     * If state is already known, returns immediately without API call.
     */
    checkAuthStatus(): Observable<boolean> {
        const currentState = this.isAuthenticated();

        if (currentState === true && !this.currentUser()) {
            return this.hydrateCurrentUser().pipe(
                map(() => true),
                catchError(() => {
                    this.isAuthenticated.set(false);
                    this.currentUser.set(null);
                    return of(false);
                })
            );
        }

        if (currentState !== null) {
            return of(currentState);
        }

        // Unknown state — verify with the server and hydrate user data
        return this.hydrateCurrentUser().pipe(
            map(() => true),
            catchError(() => {
                this.isAuthenticated.set(false);
                this.currentUser.set(null);
                return of(false);
            })
        );
    }
}
