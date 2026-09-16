import { Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { type ListParams, readListParams, writeListParams } from '../domain/list-params';

export interface ListQuery<T extends ListParams> {
  /** O que está valendo agora, já lido sobre os padrões. */
  readonly params: Signal<T>;
  /** Muda filtro. Volta para a primeira página, a menos que a página venha junto. */
  set(patch: Partial<T>): void;
  /** Anda na paginação sem mexer em mais nada. */
  page(page: number): void;
  /** Tira todo filtro da URL. */
  clear(): void;
  /** Se há algo escolhido além dos padrões — o que liga o botão "limpar". */
  readonly touched: Signal<boolean>;
}

/**
 * O estado de uma lista mora na URL, e a URL é a única fonte.
 *
 * Isso não é preferência de estilo: um filtro que só existe em memória morre no
 * F5, não volta pelo histórico e não pode ser mandado para o suporte junto do
 * chamado. O dashboard antigo faz assim em duas telas de dezoito, com o
 * encanamento copiado entre as duas.
 *
 * A troca de filtro **volta para a primeira página** de propósito: quem estava
 * na página 7 de "todos" e filtra por "falhou" quase nunca tem sete páginas de
 * falha, e cair numa página vazia parece que o filtro não achou nada.
 *
 * A leitura é derivada (`computed` sobre a URL), então ninguém precisa
 * sincronizar nada: navegar muda a URL, a URL muda o sinal, o sinal refaz o
 * recurso que depende dele.
 */
export function listQuery<T extends ListParams>(defaults: T): ListQuery<T> {
  const route = inject(ActivatedRoute);
  const router = inject(Router);

  const raw = toSignal(route.queryParamMap, { initialValue: route.snapshot.queryParamMap });
  const params = computed(() => readListParams(defaults, (key) => raw().get(key)));
  const touched = computed(() =>
    Object.keys(defaults).some((key) => key !== 'page' && params()[key] !== defaults[key]),
  );

  const go = (value: T) => {
    void router.navigate([], {
      relativeTo: route,
      queryParams: writeListParams(defaults, value),
      queryParamsHandling: 'merge',
    });
  };

  return {
    params,
    touched,
    set: (patch) => go({ ...params(), page: defaults['page'] ?? 1, ...patch }),
    page: (page) => go({ ...params(), page }),
    clear: () => go(defaults),
  };
}
