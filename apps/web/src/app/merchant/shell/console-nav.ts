/**
 * Os destinos do console.
 *
 * O mesmo objeto alimenta o trilho e a trilha de navegação da barra de cima —
 * um destino novo entra aqui e aparece nos dois, sem uma segunda tabela de
 * nomes para manter em dia.
 *
 * Os ícones são desenhados à mão, em `path` de SVG, e não vêm de biblioteca: o
 * console tem doze destinos, e doze caminhos custam menos que uma dependência
 * de ícones que chega inteira no bundle para entregar doze.
 */
export interface NavItem {
  /** O rótulo humano. Vira item do trilho e migalha da trilha. */
  readonly label: string;
  readonly route: string;
  /** Uma linha de contexto, mostrada no título do item recolhido. */
  readonly hint: string;
  /** Só fica ativo em correspondência exata (a raiz `/dashboard` precisa). */
  readonly exact?: boolean;
  /** O desenho do ícone: `d` de um `<path>` numa caixa de 24×24. */
  readonly icon: string;
}

export interface NavGroup {
  readonly label: string;
  readonly items: readonly NavItem[];
}

const ICON = {
  overview: 'M4 13h7V4H4v9Zm0 7h7v-5H4v5Zm9 0h7v-9h-7v9Zm0-16v5h7V4h-7Z',
  links: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1m-2 6a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  payments: 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 3h3v3h-3v-3Zm3-3h3v3h-3v-3Z',
  customers:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.9',
  products: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4H6Zm-3 4h18M16 10a4 4 0 0 1-8 0',
  receipts: 'M6 2v20l3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2Zm4 7h6m-6 5h6',
  ledger: 'M3 8h14l-3-3m3 11H3l3 3',
  withdrawals: 'M12 3v12m0 0-4-4m4 4 4-4M4 19h16',
  api: 'M14 7a5 5 0 1 1 3 9h-1m-3-4L4 21m0 0H8m-4 0v-4',
  webhooks: 'M9 8a3 3 0 1 1 4 2.8L16 16m2-2a3 3 0 1 1-1 5.8H9m-1-8a3 3 0 1 0-3 5.6',
  alerts: 'M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 0 1-3.4 0',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
} as const;

export const CONSOLE_NAV: readonly NavGroup[] = [
  {
    label: 'Operação',
    items: [
      {
        label: 'Visão Geral',
        route: '/dashboard',
        hint: 'Saldo, volume e conversão do período',
        exact: true,
        icon: ICON.overview,
      },
      {
        label: 'Links de pagamento',
        route: '/dashboard/payment-links',
        hint: 'Cobranças compartilháveis por URL',
        icon: ICON.links,
      },
      {
        label: 'Pagamentos',
        route: '/dashboard/payments',
        hint: 'Toda cobrança Pix e seu desfecho',
        icon: ICON.payments,
      },
      {
        label: 'Clientes',
        route: '/dashboard/customers',
        hint: 'Pagadores identificados por documento',
        icon: ICON.customers,
      },
      {
        label: 'Produtos',
        route: '/dashboard/products',
        hint: 'Catálogo reutilizável nas cobranças',
        icon: ICON.products,
      },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      {
        label: 'Comprovantes',
        route: '/dashboard/receipts',
        hint: 'Recibos de pagamento confirmado',
        icon: ICON.receipts,
      },
      {
        label: 'Saldo e Extrato',
        route: '/dashboard/financials',
        hint: 'Disponível, a liberar e bloqueado',
        icon: ICON.ledger,
      },
      {
        label: 'Saques',
        route: '/dashboard/withdrawals',
        hint: 'Retiradas para uma chave Pix',
        icon: ICON.withdrawals,
      },
    ],
  },
  {
    label: 'Integração',
    items: [
      {
        label: 'API',
        route: '/dashboard/api',
        hint: 'Chaves TEST e LIVE da loja',
        icon: ICON.api,
      },
      {
        label: 'Webhooks',
        route: '/dashboard/webhooks',
        hint: 'Destinos assinados e entregas',
        icon: ICON.webhooks,
      },
      {
        label: 'Alertas',
        route: '/dashboard/alerts',
        hint: 'Avisos operacionais por canal',
        icon: ICON.alerts,
      },
    ],
  },
];

/** Destino que não mora no trilho, mas precisa de rótulo na trilha. */
export const CONSOLE_SETTINGS: NavItem = {
  label: 'Configurações',
  route: '/dashboard/settings',
  hint: 'Conta, loja e condição comercial',
  icon: ICON.settings,
};

/**
 * Segmento de URL → rótulo, para a trilha de navegação.
 *
 * Derivado da navegação, com os apelidos de rota que não têm item próprio. O
 * segmento que sobra — um id — vira "Detalhe", em vez de vazar o uuid na tela.
 */
export const SEGMENT_LABELS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    [...CONSOLE_NAV.flatMap((group) => group.items), CONSOLE_SETTINGS].map((item) => [
      item.route.split('/').filter(Boolean).pop()!,
      item.label,
    ]),
  ),
  dashboard: 'Visão Geral',
  'api-keys': 'API',
};
