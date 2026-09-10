/**
 * A loja, como o admin a recebe.
 *
 * Estes tipos são declarados aqui e não importados de `core/services/store.service`,
 * e a razão não é evitar acoplamento por princípio: é que as duas superfícies
 * leem lojas diferentes. O lojista lê a *própria* loja e nunca precisa saber de
 * qual comerciante ela é; o admin lê *qualquer* loja e começa toda investigação
 * exatamente por aí — `merchantId` é o primeiro campo que ele usa, e é o único
 * que o contrato do lojista não tem.
 *
 * O efeito colateral é que `admin/` não importa nada de `features/dashboard` nem
 * de `core/services/store.service`, então o dia em que ele virar `apps/admin` a
 * pasta viaja inteira.
 */

/** Onde uma loja está no caminho para cobrar de verdade. */
export type StoreLiveStatus = 'NOT_REQUESTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

/**
 * A loja inteira, como o detalhe a devolve.
 *
 * Carrega a condição comercial porque é ela que o admin muda, e `merchantId`
 * porque é por ele que se cruza uma loja com o resto do que aquele comerciante
 * opera.
 */
export interface AdminStore {
  id: string;
  merchantId: string;
  name: string;
  slug: string;
  isActive: boolean;
  liveStatus: StoreLiveStatus;
  liveStatusReason?: string;
  liveStatusChangedAt?: string;
  settlementDays: number;
  feePercent: number;
  feeFixed: number;
  city?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * O que a fila mostra sobre uma loja.
 *
 * Deliberadamente menos do que `AdminStore`: a fila não carrega ledger,
 * pagamento, segredo nem chave. Investigar é outra tela, e ela pede a loja
 * inteira por outra rota.
 */
export interface AdminStoreListItem {
  id: string;
  merchantId: string;
  name: string;
  slug: string;
  liveStatus: StoreLiveStatus;
  liveStatusReason?: string;
  liveStatusChangedAt?: string;
  createdAt: string;
}
