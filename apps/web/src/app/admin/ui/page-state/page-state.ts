import { Component, computed, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInbox, lucideTriangleAlert } from '@ng-icons/lucide';

export type AdmPageStateVariant = 'loading' | 'empty' | 'error';

const DEFAULTS: Record<AdmPageStateVariant, { icon: string; heading?: string; message?: string }> =
  {
    loading: { icon: '', message: 'Carregando…' },
    empty: { icon: 'lucideInbox', heading: 'Nada por aqui' },
    error: { icon: 'lucideTriangleAlert', heading: 'Não foi possível carregar' },
  };

/**
 * As três telas que toda tela tem antes de ter conteúdo.
 *
 *   <adm-page-state variant="loading" message="Lendo a fila…" />
 *   <adm-page-state variant="error" [message]="svc.error()!">
 *     <button pageStateAction class="adm-btn adm-btn-quiet adm-btn-sm">Tentar de novo</button>
 *   </adm-page-state>
 *
 * `frame="bare"` tira a moldura, para quando o bloco já está dentro de um
 * painel. Qualquer ícone lucide serve, desde que a tela que hospeda o bloco
 * também o registre — `provideIcons` herda do pai.
 */
@Component({
  selector: 'adm-page-state',
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
export class AdmPageState {
  readonly variant = input<AdmPageStateVariant>('loading');

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
