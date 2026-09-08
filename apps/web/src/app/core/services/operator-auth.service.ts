import { inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, shareReplay, tap, throwError } from 'rxjs';
import { ApiClientService } from './api-client.service';

export interface OperatorLoginDto {
  email: string;
  password: string;
}

export interface CurrentOperator {
  id: string;
  name: string;
  email: string;
}

export interface OperatorLoginResponse {
  expiresIn: number;
  operator: CurrentOperator;
}

/**
 * A sessão da mesa, separada da do lojista de ponta a ponta.
 *
 * Não há herança nem composição com `AuthService`, e a razão é a mesma que fez
 * `Operator` ser tabela própria no backend em vez de uma coluna `role`: a
 * fronteira é estrutural lá embaixo, e um serviço que soubesse das duas
 * sessões a dissolveria aqui em cima.
 *
 * As duas convivem no mesmo browser sem se atrapalhar porque os cookies têm
 * paths próprios — `hockpay_op_at` só é enviado para `/api/v1/operator`. Isso
 * é propriedade do backend; o que este serviço faz é não reintroduzir a mistura.
 */
@Injectable({
  providedIn: 'root',
})
export class OperatorAuthService {
  private readonly api = inject(ApiClientService);

  /**
   * Estado da sessão de operador.
   * - `null`  → desconhecido (primeira carga, recarga de página)
   * - `true`  → autenticado
   * - `false` → não autenticado
   */
  readonly isAuthenticated = signal<boolean | null>(null);

  /** Operador da sessão atual. */
  readonly currentOperator = signal<CurrentOperator | null>(null);

  /** Refresh compartilhado entre 401s concorrentes. */
  private refreshRequest$: Observable<unknown> | null = null;

  login(dto: OperatorLoginDto): Observable<OperatorLoginResponse> {
    return this.api.post<OperatorLoginResponse>('/operator/auth/login', dto).pipe(
      tap((response) => {
        this.isAuthenticated.set(true);
        this.currentOperator.set(response.operator);
      }),
    );
  }

  logout(): Observable<void> {
    return this.api.post<void>('/operator/auth/logout', {}).pipe(tap(() => this.clear()));
  }

  /** Coordena um refresh de operador entre requisições concorrentes. */
  handleTokenRefresh(): Observable<unknown> {
    if (!this.refreshRequest$) {
      this.refreshRequest$ = this.api.post('/operator/auth/refresh', {}).pipe(
        tap(() => this.isAuthenticated.set(true)),
        catchError((err) => {
          this.clear();
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

  /** Carrega o operador da sessão e, com isso, confirma que ela existe. */
  hydrateCurrentOperator(): Observable<CurrentOperator> {
    return this.api.get<CurrentOperator>('/operator/me').pipe(
      tap((operator) => {
        this.isAuthenticated.set(true);
        this.currentOperator.set(operator);
      }),
    );
  }

  /**
   * Verifica a sessão de operador, hidratando o perfil no caminho.
   * Estado já conhecido responde sem ida ao servidor.
   */
  checkAuthStatus(): Observable<boolean> {
    const currentState = this.isAuthenticated();

    if (currentState === true && this.currentOperator()) {
      return of(true);
    }

    if (currentState === false) {
      return of(false);
    }

    return this.hydrateCurrentOperator().pipe(
      map(() => true),
      catchError(() => {
        this.clear();
        return of(false);
      }),
    );
  }

  private clear(): void {
    this.isAuthenticated.set(false);
    this.currentOperator.set(null);
  }
}
