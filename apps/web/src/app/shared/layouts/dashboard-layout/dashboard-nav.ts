import {
  lucideArrowRightLeft,
  lucideBanknoteArrowDown,
  lucideBellRing,
  lucideKeyRound,
  lucideLayoutDashboard,
  lucideLink,
  lucideQrCode,
  lucideReceipt,
  lucideSettings,
  lucideShoppingBag,
  lucideUsers,
  lucideWebhook,
} from '@ng-icons/lucide';

/**
 * Um destino do dashboard.
 *
 * O mesmo objeto alimenta a sidebar, o breadcrumb e o ⌘K — se um destino
 * novo entra aqui, ele aparece nos três lugares sem edição extra.
 */
export interface NavItem {
  /** Rótulo humano. É o que vira breadcrumb e resultado de busca. */
  readonly label: string;
  /** Nome do ícone lucide, já registrado em `DASHBOARD_NAV_ICONS`. */
  readonly icon: string;
  /** Rota absoluta. */
  readonly route: string;
  /** Uma linha de contexto — só o ⌘K usa. */
  readonly hint: string;
  /** Só fica ativo em match exato (a raiz `/dashboard` precisa disso). */
  readonly exact?: boolean;
  /** Sinônimos para a busca. O usuário digita "chave", queremos "API". */
  readonly aliases?: readonly string[];
}

export interface NavGroup {
  readonly label: string;
  readonly items: readonly NavItem[];
}

/** Navegação principal, na ordem em que aparece na sidebar. */
export const DASHBOARD_NAV: readonly NavGroup[] = [
  {
    label: 'Operação',
    items: [
      {
        label: 'Visão Geral',
        icon: 'lucideLayoutDashboard',
        route: '/dashboard',
        hint: 'Saldo, volume e conversão do período',
        exact: true,
        aliases: ['home', 'inicio', 'metricas', 'overview'],
      },
      {
        label: 'Links de pagamento',
        icon: 'lucideLink',
        route: '/dashboard/payment-links',
        hint: 'Cobranças compartilháveis por URL',
        aliases: ['link', 'checkout', 'cobrar'],
      },
      {
        label: 'Pagamentos',
        icon: 'lucideQrCode',
        route: '/dashboard/payments',
        hint: 'Todas as cobranças Pix e seus desfechos',
        aliases: ['pix', 'cobranca', 'transacoes', 'charges'],
      },
      {
        label: 'Clientes',
        icon: 'lucideUsers',
        route: '/dashboard/customers',
        hint: 'Pagadores identificados por externalId',
        aliases: ['pagadores', 'customers'],
      },
      {
        label: 'Produtos',
        icon: 'lucideShoppingBag',
        route: '/dashboard/products',
        hint: 'Catálogo reutilizável nas cobranças',
        aliases: ['catalogo', 'itens'],
      },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      {
        label: 'Comprovantes',
        icon: 'lucideReceipt',
        route: '/dashboard/receipts',
        hint: 'Recibos emitidos por pagamento confirmado',
        aliases: ['recibo', 'receipts'],
      },
      {
        label: 'Saldo e Extrato',
        icon: 'lucideArrowRightLeft',
        route: '/dashboard/financials',
        hint: 'Ledger da loja: disponível, a liberar e bloqueado',
        aliases: ['ledger', 'balance', 'extrato', 'saldo'],
      },
      {
        label: 'Saques',
        icon: 'lucideBanknoteArrowDown',
        route: '/dashboard/withdrawals',
        hint: 'Retiradas para conta bancária',
        aliases: ['withdrawal', 'retirada', 'transferencia'],
      },
    ],
  },
  {
    label: 'Integração',
    items: [
      {
        label: 'API',
        icon: 'lucideKeyRound',
        route: '/dashboard/api',
        hint: 'Chaves TEST e LIVE da loja',
        aliases: ['chave', 'api key', 'token', 'secret'],
      },
      {
        label: 'Webhooks',
        icon: 'lucideWebhook',
        route: '/dashboard/webhooks',
        hint: 'Endpoints assinados e entregas',
        aliases: ['callback', 'evento', 'entrega'],
      },
      {
        label: 'Alertas',
        icon: 'lucideBellRing',
        route: '/dashboard/alerts',
        hint: 'Notificações por e-mail e canal',
        aliases: ['notificacao', 'aviso'],
      },
    ],
  },
];

/**
 * Destinos que não moram na sidebar mas precisam de rótulo e de busca —
 * hoje só Configurações, que vive no menu do usuário.
 */
export const DASHBOARD_ASIDE_DESTINATIONS: readonly NavItem[] = [
  {
    label: 'Configurações',
    icon: 'lucideSettings',
    route: '/dashboard/settings',
    hint: 'Perfil da loja, conta bancária e sessão',
    aliases: ['conta', 'perfil', 'settings', 'banco'],
  },
];

/** Tudo que o ⌘K sabe abrir. */
export const DASHBOARD_DESTINATIONS: readonly NavItem[] = [
  ...DASHBOARD_NAV.flatMap((group) => group.items),
  ...DASHBOARD_ASIDE_DESTINATIONS,
];

/**
 * Segmento de URL → rótulo, para o breadcrumb.
 *
 * Derivado da navegação, com os apelidos de rota que não têm item próprio.
 * Segmentos que sobram (um id, por exemplo) viram "Detalhe" no topbar.
 */
export const SEGMENT_LABELS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    DASHBOARD_DESTINATIONS.map((item) => [
      item.route.split('/').filter(Boolean).pop()!,
      item.label,
    ]),
  ),
  dashboard: 'Visão Geral',
  'api-keys': 'API',
  stores: 'Lojas',
};

/** Registro de ícones exigido pelo `provideIcons` das peças do shell. */
export const DASHBOARD_NAV_ICONS = {
  lucideArrowRightLeft,
  lucideBanknoteArrowDown,
  lucideBellRing,
  lucideKeyRound,
  lucideLayoutDashboard,
  lucideLink,
  lucideQrCode,
  lucideReceipt,
  lucideSettings,
  lucideShoppingBag,
  lucideUsers,
  lucideWebhook,
};
