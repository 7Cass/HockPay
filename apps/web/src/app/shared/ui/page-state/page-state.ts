import { Component, computed, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInbox, lucideTriangleAlert } from '@ng-icons/lucide';

export type PageStateVariant = 'loading' | 'empty' | 'error';

const DEFAULTS: Record<PageStateVariant, { icon: string; heading?: string; message?: string }> = {
  loading: { icon: '', message: 'Carregando…' },
  empty: { icon: 'lucideInbox', heading: 'Nada por aqui ainda' },
  error: { icon: 'lucideTriangleAlert', heading: 'Não foi possível carregar' },
};

/**
 * As três telas que toda tela tem antes de ter conteúdo.
 *
 *   <app-page-state variant="loading" message="Buscando clientes…" />
 *   <app-page-state variant="error" [message]="svc.error()!" />
 *   <app-page-state variant="empty" icon="lucideUsers" heading="Nenhum cliente"
 *                   message="Clientes aparecem quando houver pagamento identificado.">
 *     <button pageStateAction class="btn btn-quiet">Limpar busca</button>
 *   </app-page-state>
 *
 * `frame="bare"` tira a moldura, para quando o bloco já está dentro de um
 * painel (o caso das tabelas). Qualquer ícone lucide serve, desde que a tela
 * que hospeda o bloco também o registre — `provideIcons` herda do pai.
 */
@Component({
  selector: 'app-page-state',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideInbox, lucideTriangleAlert })],
  templateUrl: './page-state.html',
  styleUrl: './page-state.css',
  host: {
    '[attr.data-variant]': 'variant()',
    '[class.is-bare]': "frame() === 'bare'",
    role: 'status',
    '[attr.aria-busy]': "variant() === 'loading'",
  },
})
export class PageState {
  readonly variant = input<PageStateVariant>('loading');

  /** Nome do ícone lucide. Cada variante tem o seu padrão. */
  readonly icon = input<string>();

  readonly heading = input<string>();

  readonly message = input<string>();

  /** `panel` desenha a moldura; `bare` assume que já existe uma em volta. */
  readonly frame = input<'panel' | 'bare'>('panel');

  protected readonly iconName = computed(() => this.icon() ?? DEFAULTS[this.variant()].icon);
  protected readonly headingText = computed(
    () => this.heading() ?? DEFAULTS[this.variant()].heading,
  );
  protected readonly messageText = computed(
    () => this.message() ?? DEFAULTS[this.variant()].message,
  );
}
