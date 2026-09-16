import { Component, input } from '@angular/core';

/**
 * O número que a tela abre.
 *
 *   <mer-stat label="Disponível" value="R$ 88.152,37" note="Pronto para sacar" />
 *
 * O rótulo em caixa alta pequena, o número grande e tabular, e uma linha de
 * contexto embaixo — porque um número de dinheiro sem o que ele significa
 * obriga a abrir outra tela para saber se é bom ou ruim.
 *
 * O valor entra formatado: formatar dinheiro é decisão da tela (moeda, casas),
 * e um componente que recebe centavos e chuta o resto erra em LIVE.
 */
@Component({
  selector: 'mer-stat',
  standalone: true,
  template: `
    <p class="mer-overline">{{ label() }}</p>
    <p class="value mer-num">{{ value() }}</p>
    @if (note(); as text) {
      <p class="note">{{ text }}</p>
    }
  `,
  styleUrl: './stat.css',
  host: { class: 'mer-stat' },
})
export class MerStat {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly note = input<string>();
}
