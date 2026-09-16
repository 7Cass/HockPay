import { Component, ViewEncapsulation, booleanAttribute, computed, input } from '@angular/core';

export type MerButtonVariant = 'primary' | 'quiet' | 'ghost' | 'danger';
export type MerButtonSize = 'sm' | 'md';

/**
 * O botão do console.
 *
 *   <button merButton variant="primary" (click)="save()">Salvar</button>
 *   <button merButton variant="ghost" iconOnly aria-label="Atualizar">…</button>
 *   <a merButton variant="quiet" routerLink="/dashboard/payments">Ver todos</a>
 *
 * Seletor de atributo, e não de elemento: `type`, `disabled`, `routerLink` e os
 * `aria-*` continuam sendo do elemento nativo, e o teste continua achando
 * `button` no DOM, sem invólucro no meio.
 *
 * `primary` é osso sobre carvão — o inverso do fundo, e não uma cor nova. Numa
 * tela onde a cor diz estado, botão colorido disputa atenção com um aviso de
 * verdade. `danger` é contornado pelo mesmo motivo.
 *
 * `loading` desabilita, troca o conteúdo por um giro e **mantém a largura**: um
 * botão que encolhe no meio de um POST move a próxima ação para debaixo do
 * ponteiro.
 */
@Component({
  selector: 'button[merButton], a[merButton]',
  standalone: true,
  template: `
    @if (loading()) {
      <span class="mer-btn-spin" aria-hidden="true"></span>
    }
    <ng-content />
  `,
  styleUrl: './button.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'mer-btn',
    '[attr.data-variant]': 'variant()',
    '[attr.data-size]': 'size()',
    '[class.is-icon]': 'iconOnly()',
    '[class.is-block]': 'block()',
    '[class.is-loading]': 'loading()',
    '[attr.aria-busy]': 'loading() ? "true" : null',
    '[attr.disabled]': 'blocked()',
    '[attr.tabindex]': 'blocked() ? -1 : null',
  },
})
export class MerButton {
  /** Uma `primary` por tela: duas significam que nenhuma era primária. */
  readonly variant = input<MerButtonVariant>('quiet');

  readonly size = input<MerButtonSize>('md');

  /** Quadrado, para quando o ícone já diz tudo. Exige `aria-label`. */
  readonly iconOnly = input(false, { transform: booleanAttribute });

  /** Ocupa a linha inteira — formulário estreito, painel modal. */
  readonly block = input(false, { transform: booleanAttribute });

  readonly loading = input(false, { transform: booleanAttribute });

  /**
   * Entrada, e não o atributo nativo: quem decide se o botão aceita clique são
   * duas coisas — a página e o próprio botão (`loading`). Com duas fontes
   * escrevendo o mesmo atributo, a última a rodar apagava a da página.
   */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** `true` ou `null`: `disabled="false"` no HTML também desabilita. */
  protected readonly blocked = computed(() => (this.disabled() || this.loading() ? true : null));
}
