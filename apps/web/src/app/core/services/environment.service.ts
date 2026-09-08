import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { ApiClientService } from './api-client.service';
import { AuthService } from './auth.service';
import { StoreLiveStatus, StoreService } from './store.service';

export type ApiEnvironment = 'TEST' | 'LIVE';

export interface SwitchEnvironmentResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  environment: ApiEnvironment;
}

/**
 * Por que a opção LIVE está fechada — e ela aparece fechada, não escondida.
 *
 * Ver a porta que existe é como o lojista descobre que ela existe, e é o que a
 * fatia de habilitação existe para ensinar.
 */
export const LIVE_BLOCKED_REASON: Record<Exclude<StoreLiveStatus, 'APPROVED'>, string> = {
  NOT_REQUESTED: 'Esta loja ainda não pediu habilitação LIVE.',
  PENDING: 'O pedido de habilitação LIVE está em análise pela mesa.',
  REJECTED: 'A mesa recusou a habilitação LIVE desta loja.',
  SUSPENDED: 'A mesa suspendeu a habilitação LIVE desta loja.',
};

/**
 * O ambiente da sessão do dashboard.
 *
 * Ele **não é um filtro de cliente**. A troca re-emite o par de tokens no
 * backend, e a tela recarrega inteira: tratar o resultado como filtro deixaria
 * dado de um ambiente na tela do outro por um instante, que é exatamente a
 * confusão que o ledger por ambiente separou para evitar.
 *
 * Quem decide se LIVE é permitido é o backend, no use case de troca. O que
 * mora aqui é só o que a tela precisa para não oferecer uma porta fechada sem
 * dizer por quê.
 */
@Injectable({
  providedIn: 'root',
})
export class EnvironmentService {
  private readonly api = inject(ApiClientService);
  private readonly authService = inject(AuthService);
  private readonly storeService = inject(StoreService);

  /** Troca em andamento — a tela desabilita o seletor enquanto isso. */
  readonly isSwitching = signal(false);

  /**
   * O ambiente que a sessão realmente está, dito pelo servidor.
   *
   * Vem de `/merchants/me`, e não de um palpite local: o `?? TEST` do guard é
   * silencioso, e uma tela mostrando LIVE numa sessão que caiu para TEST seria
   * a mentira mais cara que o simulador consegue contar.
   */
  readonly current = computed<ApiEnvironment>(
    () => this.authService.currentUser()?.currentEnvironment ?? 'TEST',
  );

  readonly isLive = computed(() => this.current() === 'LIVE');

  private readonly liveStatus = computed<StoreLiveStatus>(
    () => this.storeService.currentStore()?.liveStatus ?? 'NOT_REQUESTED',
  );

  readonly canSelectLive = computed(() => this.liveStatus() === 'APPROVED');

  /** `null` quando LIVE está aberto. */
  readonly liveBlockedReason = computed<string | null>(() => {
    const status = this.liveStatus();
    return status === 'APPROVED' ? null : LIVE_BLOCKED_REASON[status];
  });

  /**
   * Troca o ambiente da sessão e recarrega o dashboard.
   *
   * O reload é deliberado, como em `switchStore`: os cookies novos precisam
   * entrar numa sessão limpa, e nenhum dado do ambiente anterior sobrevive à
   * troca.
   */
  switchEnvironment(environment: ApiEnvironment): Observable<SwitchEnvironmentResponse> {
    this.isSwitching.set(true);

    return this.api
      .post<SwitchEnvironmentResponse>('/auth/switch-environment', { environment })
      .pipe(
        tap({
          next: () => this.reloadDashboard(),
          error: () => this.isSwitching.set(false),
        }),
      );
  }

  private reloadDashboard(): void {
    window.location.href = '/dashboard';
  }
}
