import { Component, ViewEncapsulation, booleanAttribute, input } from '@angular/core';

/**
 * Um campo, com tudo que um campo precisa em volta.
 *
 *   <adm-field label="Taxa variável (%)" for="fee-percent"
 *              hint="atual 2,5% · faixa 0–10%"
 *              [error]="outOfRange() ? 'fora da faixa aceita' : ''"
 *              [changed]="fieldChanged('feePercent')">
 *     <input id="fee-percent" type="number" … />
 *   </adm-field>
 *
 * O controle é o nativo, projetado: um `<input>` embrulhado em componente perde
 * `type`, `step`, `min`, `formControlName`, autocomplete do navegador e metade
 * do que um leitor de tela sabe fazer com ele. O que o componente dá é o que
 * sempre se esquece de dar — o `<label>` amarrado, a dica, o erro com `role`,
 * o `aria-invalid` — e a pele, que aqui alcança o controle projetado porque o
 * estilo é global e preso a `adm-field`.
 *
 * `changed` marca o campo que difere do que está gravado. Numa tela onde o
 * formulário nasce preenchido com a condição de hoje, saber o que foi mexido é
 * metade da revisão antes de gravar.
 */
@Component({
  selector: 'adm-field',
  standalone: true,
  template: `
    @if (label(); as text) {
      <label class="adm-field-label" [attr.for]="for()">
        {{ text }}
        @if (changed()) {
          <span class="adm-field-dot" title="alterado" aria-label="alterado"></span>
        }
      </label>
    }

    <div class="adm-field-control">
      <ng-content />
      <ng-content select="[fieldSuffix]" />
    </div>

    @if (hint(); as text) {
      <span class="adm-field-hint">{{ text }}</span>
    }

    <span class="adm-field-hint"><ng-content select="[fieldHint]" /></span>

    @if (error(); as text) {
      <span class="adm-field-error" role="alert">{{ text }}</span>
    }
  `,
  styleUrl: './field.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'adm-field',
    '[class.is-invalid]': '!!error()',
    '[class.is-changed]': 'changed()',
  },
})
export class AdmField {
  readonly label = input<string>();

  /** O `id` do controle projetado. Sem ele o rótulo não clica no campo. */
  readonly for = input<string>();

  readonly hint = input<string>();

  /** Vazio significa campo válido — a mensagem é a própria condição. */
  readonly error = input<string>();

  readonly changed = input(false, { transform: booleanAttribute });
}
