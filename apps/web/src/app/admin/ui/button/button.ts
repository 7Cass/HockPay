import { Component, ViewEncapsulation, booleanAttribute, computed, input } from '@angular/core';

export type AdmButtonVariant = 'primary' | 'quiet' | 'ghost' | 'danger' | 'accent';
export type AdmButtonSize = 'sm' | 'md';

/**
 * O botão da mesa.
 *
 *   <button admButton variant="primary" (click)="save()">Mudar condição</button>
 *   <button admButton variant="ghost" iconOnly aria-label="Atualizar">…</button>
 *   <a admButton variant="quiet" routerLink="/operator">Fila</a>
 *
 * O seletor é de atributo, e não de elemento, por dois motivos práticos: o
 * `type`, o `disabled`, o `routerLink` e o `aria-*` continuam sendo do elemento
 * nativo — nada de reexportar `@Input()` para cada atributo que um `<button>` já
 * tem — e o teste continua encontrando `button` no DOM, sem um invólucro no meio.
 *
 * `loading` é estado do botão e não do texto: ele desabilita, troca o ícone por
 * um giro e mantém a largura, porque um botão que encolhe no meio de um POST
 * move a próxima ação para debaixo do ponteiro.
 */
@Component({
  selector: 'button[admButton], a[admButton]',
  standalone: true,
  template: `
    @if (loading()) {
      <span class="spin" aria-hidden="true"></span>
    }
    <ng-content />
  `,
  styleUrl: './button.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'adm-btn',
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
export class AdmButton {
  /**
   * `primary` fecha o assunto — uma por tela, porque duas significam que nenhuma
   * era primária. `quiet` é o botão de todo dia. `ghost` é para barra de
   * ferramentas, onde uma borda a mais só faz ruído. `danger` é contornado e não
   * preenchido: vermelho sólido numa mesa de operação vira o elemento mais
   * chamativo da tela e convida ao clique justamente onde o clique custa.
   * `accent` existe para uma única coisa — a ação que confirma uma navegação,
   * nunca uma que grava.
   */
  readonly variant = input<AdmButtonVariant>('quiet');

  readonly size = input<AdmButtonSize>('md');

  /** Quadrado, para quando o ícone já diz tudo. Exige `aria-label`. */
  readonly iconOnly = input(false, { transform: booleanAttribute });

  /** Ocupa a linha inteira — formulário estreito, painel modal. */
  readonly block = input(false, { transform: booleanAttribute });

  readonly loading = input(false, { transform: booleanAttribute });

  /**
   * O `disabled` é entrada do componente, e não o atributo nativo, porque quem
   * decide se o botão aceita clique são duas coisas: a página (`[disabled]`) e o
   * próprio botão (`loading`). Com duas fontes escrevendo o mesmo atributo, a
   * última a rodar ganha — e a última era sempre a do componente, que apagava a
   * da página. Com a entrada, as duas se somam num lugar só.
   */
  readonly disabled = input(false, { transform: booleanAttribute });

  /**
   * `true` ou `null`, porque `disabled="false"` no HTML também desabilita.
   * Em `<a>` o atributo não faz nada, e é o `tabindex` que tira o foco.
   */
  protected readonly blocked = computed(() => (this.disabled() || this.loading() ? true : null));
}
