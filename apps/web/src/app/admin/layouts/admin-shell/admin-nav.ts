import { lucideInbox, lucideScrollText } from '@ng-icons/lucide';

/** Um destino do admin. */
export interface AdminNavItem {
  readonly label: string;
  readonly icon: string;
  readonly route: string;
  /** Só fica ativo em match exato (a raiz `/operator` precisa disso). */
  readonly exact?: boolean;
  /**
   * A segunda tecla do atalho de ida: `g` e depois esta. É o par que todo
   * console de operação usa, e o que permite trocar de tela sem tirar a mão do
   * teclado no meio de um chamado.
   */
  readonly key: string;
  /** A frase de uma linha que a paleta de comandos mostra ao lado do destino. */
  readonly hint: string;
}

/**
 * A navegação do admin, na ordem em que ela trabalha: primeiro a fila que pede
 * decisão, depois o rastro do que já foi decidido.
 *
 * A investigação de uma loja não está aqui de propósito — ela não é um destino,
 * é onde a fila leva.
 */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  {
    label: 'Fila',
    icon: 'lucideInbox',
    route: '/operator',
    exact: true,
    key: 'f',
    hint: 'quem pede decisão',
  },
  {
    label: 'Trilha',
    icon: 'lucideScrollText',
    route: '/operator/audit-logs',
    key: 't',
    hint: 'o que já foi decidido',
  },
];

export const ADMIN_NAV_ICONS = { lucideInbox, lucideScrollText };
