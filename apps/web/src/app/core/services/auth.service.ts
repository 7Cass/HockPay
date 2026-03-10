import { inject, Injectable, signal } from '@angular/core';
import { ApiClientService } from './api-client.service';
import { BehaviorSubject, Observable, filter, map, take, tap, throwError, catchError, of } from 'rxjs';

export interface LoginDto {
    email: string;
    password?: string;
}

export interface LoginResponse {
    accessToken: string;
    merchant: {
        id: string;
        email: string;
        name: string;
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

    /**
     * Tracks whether a token refresh is currently in progress.
     */
    private isRefreshing = false;

    /**
     * Signal bus for concurrent requests waiting on a refresh.
     */
    private readonly refreshSubject = new BehaviorSubject<boolean>(false);

    /**
     * Authenticates the merchant with email and password.
     * Populates currentUser with the data from the login response.
     */
    login(dto: LoginDto): Observable<LoginResponse> {
        return this.api.post<LoginResponse>('/auth/login', dto).pipe(
            tap((response) => {
                this.isAuthenticated.set(true);
                // Populate basic user data from login response.
                // Full profile will be loaded via /merchants/me on next guard check.
                this.currentUser.set({
                    id: response.merchant.id,
                    name: response.merchant.name,
                    email: response.merchant.email,
                    document: '',
                    formattedDocument: '',
                    documentType: 'CPF',
                    isActive: true,
                    createdAt: '',
                });
            })
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
        if (!this.isRefreshing) {
            this.isRefreshing = true;
            this.refreshSubject.next(false);

            return this.api.post('/auth/refresh', {}).pipe(
                tap(() => {
                    this.isRefreshing = false;
                    this.isAuthenticated.set(true);
                    this.refreshSubject.next(true);
                }),
                catchError((err) => {
                    this.isRefreshing = false;
                    this.isAuthenticated.set(false);
                    this.currentUser.set(null);
                    this.refreshSubject.next(false);
                    return throwError(() => err);
                })
            );
        }

        return this.refreshSubject.pipe(
            filter(done => done),
            take(1),
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

        if (currentState !== null) {
            return of(currentState);
        }

        // Unknown state — verify with the server and hydrate user data
        return this.api.get<CurrentUser>('/merchants/me').pipe(
            map((user) => {
                this.isAuthenticated.set(true);
                this.currentUser.set(user);
                return true;
            }),
            catchError(() => {
                this.isAuthenticated.set(false);
                this.currentUser.set(null);
                return of(false);
            })
        );
    }
}
