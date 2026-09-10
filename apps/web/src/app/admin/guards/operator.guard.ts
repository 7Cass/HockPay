import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { map } from 'rxjs';
import { OperatorAuthService } from '../services/operator-auth.service';

/**
 * Protege as rotas da mesa.
 *
 * Não reusa `authGuard`, e isso é decisão e não repetição: um guard só com um
 * `if (isOperator)` dentro é a mesma condicional que o backend recusou quando
 * fez de `Operator` uma tabela própria. Sessão de lojista aqui não vale nada —
 * ela nem é consultada.
 */
export const operatorGuard: CanActivateFn = () => {
  const router = inject(Router);
  const operatorAuth = inject(OperatorAuthService);

  const state = operatorAuth.isAuthenticated();

  if (state === true && operatorAuth.currentOperator()) {
    return true;
  }

  if (state === false) {
    return router.createUrlTree(['/operator/login']);
  }

  return operatorAuth
    .checkAuthStatus()
    .pipe(
      map((isAuthenticated) =>
        isAuthenticated ? true : router.createUrlTree(['/operator/login']),
      ),
    );
};

/**
 * Impede que uma sessão de mesa já aberta volte para o login da mesa.
 */
export const operatorGuestGuard: CanActivateFn = () => {
  const router = inject(Router);
  const operatorAuth = inject(OperatorAuthService);

  const state = operatorAuth.isAuthenticated();

  if (state === true) {
    return router.createUrlTree(['/operator']);
  }

  if (state === false) {
    return true;
  }

  return operatorAuth
    .checkAuthStatus()
    .pipe(map((isAuthenticated) => (isAuthenticated ? router.createUrlTree(['/operator']) : true)));
};
