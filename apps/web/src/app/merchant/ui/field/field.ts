import { Component, ViewEncapsulation, booleanAttribute, input } from '@angular/core';

/**
 * O campo: rótulo, controle e o que se diz embaixo dele.
 *
 *   <mer-field label="Busca" grow>
 *     <input type="search" placeholder="External ID" />
 *   </mer-field>
 *
 *   <mer-field label="Valor" hint="mínimo R$ 10,00" [error]="erro()">
 *     <input inputmode="numeric" />
 *   </mer-field>
 *
 * O `<input>` é da página e vem projetado, pelo mesmo motivo da tabela: cada
 * campo tem atributos que só ele tem (`mask`, `inputmode`, `autocomplete`), e
 * reexportar cada um deles como entrada seria reconstruir o elemento nativo com
 * uma indireção em cima. O estilo alcança o controle projetado, então é global
 * e preso a `mer-field`.
 *
 * `error` e `hint` ocupam a mesma linha: o erro substitui a dica em vez de
 * empilhar, para o campo não mudar de altura ao ficar inválido — formulário que
 * pula com a validação empurra o botão para debaixo do ponteiro.
 */
@Component({
  selector: 'mer-field',
  standalone: true,
  template: `
    <label class="mer-field-label">
      <span class="mer-field-name">
        {{ label() }}
        @if (hint(); as text) {
          <span class="mer-field-hint">{{ text }}</span>
        }
      </span>
      <span class="mer-field-control"><ng-content /></span>
    </label>

    @if (error(); as text) {
      <p class="mer-field-error" role="alert">{{ text }}</p>
    } @else if (note(); as text) {
      <p class="mer-field-note">{{ text }}</p>
    }
  `,
  styleUrl: './field.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'mer-field',
    '[class.is-grow]': 'grow()',
    '[class.is-invalid]': '!!error()',
  },
})
export class MerField {
  readonly label = input<string>('');

  /** A ressalva que mora ao lado do rótulo (`CPF / CNPJ`). */
  readonly hint = input<string>();

  /** A linha de baixo, quando está tudo bem. */
  readonly note = input<string>();

  /** A linha de baixo quando não está — substitui a nota. */
  readonly error = input<string>();

  /** Ocupa o espaço que sobra na barra de filtros. */
  readonly grow = input(false, { transform: booleanAttribute });
}
