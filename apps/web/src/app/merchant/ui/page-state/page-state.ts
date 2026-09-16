import { Component, computed, input } from '@angular/core';

export type MerPageStateVariant = 'loading' | 'empty' | 'error';

const DEFAULTS: Record<MerPageStateVariant, { heading?: string; message?: string }> = {
  loading: { message: 'Carregando…' },
  empty: { heading: 'Nada por aqui' },
  error: { heading: 'Não foi possível carregar' },
};

/**
 * As três telas que toda tela tem antes de ter conteúdo.
 *
 *   <mer-page-state variant="loading" message="Lendo os pagamentos…" />
 *   <mer-page-state variant="error" [message]="payments.error()!.message">
 *     <button pageStateAction merButton size="sm">Tentar de novo</button>
 *   </mer-page-state>
 *
 * A mensagem de erro vem da falha tipada, e não de uma string montada na tela:
 * o que o lojista lê é o que a API disse, e o código fica no atributo para quem
 * abre um chamado.
 *
 * `frame="bare"` tira a moldura, para quando o bloco já está dentro de um painel.
 */
@Component({
  selector: 'mer-page-state',
  standalone: true,
  template: `
    @if (variant() === 'loading') {
      <span class="spin" aria-hidden="true"></span>
    }

    @if (headingText(); as text) {
      <h3>{{ text }}</h3>
    }

    @if (messageText(); as text) {
      <p>{{ text }}</p>
    }

    <div class="action">
      <ng-content select="[pageStateAction]" />
    </div>
  `,
  styleUrl: './page-state.css',
  host: {
    class: 'mer-page-state',
    '[attr.data-variant]': 'variant()',
    '[attr.data-code]': 'code()',
    '[class.is-bare]': "frame() === 'bare'",
    role: 'status',
    '[attr.aria-busy]': "variant() === 'loading'",
  },
})
export class MerPageState {
  readonly variant = input<MerPageStateVariant>('loading');

  readonly heading = input<string>();

  readonly message = input<string>();

  /** O código da falha, para o chamado. Fica no DOM, não na frente do lojista. */
  readonly code = input<string>();

  /** `panel` desenha a moldura; `bare` assume que já existe uma em volta. */
  readonly frame = input<'panel' | 'bare'>('panel');

  protected readonly headingText = computed(
    () => this.heading() ?? DEFAULTS[this.variant()].heading,
  );

  protected readonly messageText = computed(
    () => this.message() ?? DEFAULTS[this.variant()].message,
  );
}
