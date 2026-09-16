import { Injectable, computed, inject } from '@angular/core';

import {
  type ApiEnvironment,
  AuthService,
  EnvironmentService,
  type Store,
  StoreService,
} from '../domain/api-contracts';

/**
 * A sessão do lojista, vista pelo console.
 *
 * Os três serviços por trás disto moram em `core/` e atravessam a costura de
 * propósito: o lojista **é** a sessão que o app guarda, diferente da mesa, que
 * tem a sua. Esta peça existe para que a casca e as telas falem com um lugar
 * só, e para que a mudança da fatia 7 — trazer a sessão para dentro de
 * `merchant/data` — seja a troca das entranhas deste arquivo, e não uma
 * varredura por trinta telas.
 *
 * Nada aqui guarda estado próprio: tudo é derivado dos serviços de baixo. Uma
 * segunda cópia da loja atual ou do ambiente seria a chance de a tela mostrar
 * um e a requisição mandar outro.
 */
@Injectable({ providedIn: 'root' })
export class MerchantSession {
  private readonly auth = inject(AuthService);
  private readonly stores = inject(StoreService);
  private readonly environments = inject(EnvironmentService);

  /* ── Quem está logado ──────────────────────────────────────────────── */
  readonly user = computed(() => this.auth.currentUser());
  readonly name = computed(() => this.user()?.name ?? '');
  readonly email = computed(() => this.user()?.email ?? '');

  /** Iniciais para o crachá: o avatar é tipografia, não imagem. */
  readonly initials = computed(() => {
    const name = this.name().trim();
    if (!name) return '—';

    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('');
  });

  /* ── A loja aberta ─────────────────────────────────────────────────── */
  readonly stores$ = computed(() => this.stores.stores());
  readonly store = computed(() => this.stores.currentStore());
  readonly storeName = computed(() => this.store()?.name ?? 'Selecionar loja');
  readonly storeSlug = computed(() => this.store()?.slug ?? '');
  readonly storeInitial = computed(() => this.store()?.name?.trim()?.[0]?.toUpperCase() ?? '·');

  /* ── O ambiente da sessão ──────────────────────────────────────────── */
  readonly environment = computed<ApiEnvironment>(() => this.environments.current());
  readonly isLive = computed(() => this.environments.isLive());
  readonly canSelectLive = computed(() => this.environments.canSelectLive());
  readonly liveBlockedReason = computed(() => this.environments.liveBlockedReason());
  readonly isSwitchingEnvironment = this.environments.isSwitching;

  /** Carrega as lojas do lojista. A casca chama uma vez, ao montar. */
  loadStores(): void {
    this.stores.loadStores().subscribe({
      // A lista de lojas falhando não derruba o console: o que a tela mostra é
      // a loja que o token já carrega. O erro real aparece na primeira leitura.
      error: () => undefined,
    });
  }

  /** Troca de loja. O backend re-emite o par de tokens e o console recarrega. */
  switchStore(store: Store): void {
    if (store.id === this.store()?.id) return;
    this.stores.switchStore(store.id).subscribe({ error: () => undefined });
  }

  /**
   * Cria uma loja e abre ela.
   *
   * Passa pelo serviço de `core/` de propósito, em vez de um `POST` direto: a
   * criação re-emite o par de tokens, re-hidrata o merchant e recarrega o
   * console. Um comando cru aqui deixaria a sessão apontando para a loja antiga
   * com a tela mostrando a nova.
   */
  createStore(name: string, onError: (message: string) => void): void {
    this.stores.createStore({ name }).subscribe({
      error: (error: unknown) =>
        onError(
          (error as { error?: { error?: { message?: string } } })?.error?.error?.message ??
            'Não foi possível criar a loja.',
        ),
    });
  }

  /**
   * Troca o ambiente da sessão.
   *
   * A tela não decide se LIVE é permitido — ela só evita oferecer uma porta que
   * o use case vai fechar. Quem decide continua sendo o backend.
   */
  switchEnvironment(environment: ApiEnvironment, onError: () => void): void {
    if (environment === this.environment()) return;
    if (environment === 'LIVE' && !this.canSelectLive()) return;

    // Sem `next`: a troca recarrega a página inteira, porque nada do ambiente
    // anterior é filtrado no cliente — é recarregado.
    this.environments.switchEnvironment(environment).subscribe({ error: onError });
  }

  logout(onDone: () => void): void {
    this.auth.logout().subscribe({ next: onDone, error: onDone });
  }
}

export type { ApiEnvironment, Store };
