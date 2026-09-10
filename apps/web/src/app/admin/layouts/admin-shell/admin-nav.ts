import { lucideInbox, lucideScrollText } from '@ng-icons/lucide';

/** Um destino do admin. */
export interface AdminNavItem {
  readonly label: string;
  readonly icon: string;
  readonly route: string;
  /** Só fica ativo em match exato (a raiz `/operator` precisa disso). */
  readonly exact?: boolean;
}

/**
 * A navegação do admin, na ordem em que ela trabalha: primeiro a fila que pede
 * decisão, depois o rastro do que já foi decidido.
 *
 * A investigação de uma loja não está aqui de propósito — ela não é um destino,
 * é onde a fila leva.
 */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { label: 'Fila', icon: 'lucideInbox', route: '/operator', exact: true },
  { label: 'Trilha', icon: 'lucideScrollText', route: '/operator/audit-logs' },
];

export const ADMIN_NAV_ICONS = { lucideInbox, lucideScrollText };
