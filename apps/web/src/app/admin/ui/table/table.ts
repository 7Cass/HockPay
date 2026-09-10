import { Component, ViewEncapsulation, booleanAttribute, input } from '@angular/core';

/**
 * A moldura da tabela — onde o operador passa o dia.
 *
 *   <adm-table>
 *     <table>
 *       <thead><tr><th>Loja</th><th class="adm-col-num">Bruto</th></tr></thead>
 *       <tbody>…</tbody>
 *     </table>
 *   </adm-table>
 *
 * O componente projeta a `<table>` da página em vez de recebê-la como dado. Uma
 * tabela dirigida por configuração (`[columns]`, `[rows]`) parece mais reusável
 * e não é: cada tela da mesa tem uma célula que só ela tem — o par nome/slug da
 * loja, o antes→depois da condição, a coluna de decisão que muda por estado — e
 * toda tabela dessas termina com um `[template]` por coluna, que é a `<table>`
 * de volta, com uma camada de indireção em cima.
 *
 * O que é igual em todas — o cabeçalho grudado, a altura de linha por densidade,
 * a rolagem horizontal, o alinhamento de número, a linha clicável — é o que este
 * componente carrega. Por isso o estilo é global e preso a `adm-table`: ele
 * precisa alcançar `<td>` que a página escreveu, do outro lado da projeção.
 */
@Component({
  selector: 'adm-table',
  standalone: true,
  template: `<div class="scroll adm-scroll"><ng-content /></div>`,
  styleUrl: './table.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'adm-table',
    '[class.is-plain]': '!sticky()',
  },
})
export class AdmTable {
  /**
   * Cabeçalho grudado no topo durante a rolagem. Ligado por padrão: numa lista
   * de trinta linhas, saber qual coluna é qual sem voltar ao topo é a diferença
   * entre ler e adivinhar.
   */
  readonly sticky = input(true, { transform: booleanAttribute });
}
