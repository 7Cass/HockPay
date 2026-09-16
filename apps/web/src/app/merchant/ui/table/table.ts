import { Component, ViewEncapsulation, booleanAttribute, input } from '@angular/core';

/**
 * A moldura da tabela.
 *
 *   <mer-table>
 *     <table>
 *       <thead><tr><th>Data</th><th class="mer-col-num">Bruto</th></tr></thead>
 *       <tbody>…</tbody>
 *     </table>
 *   </mer-table>
 *
 * A página projeta a própria `<table>` em vez de passar colunas como dado. Uma
 * tabela dirigida por configuração (`[columns]`, `[rows]`) parece mais reusável
 * e não é: cada tela tem uma célula que só ela tem — o par descrição/id do
 * pagamento, o pagador com link para o cliente, a tentativa de um link — e toda
 * tabela dessas termina com um `[template]` por coluna, que é a `<table>` de
 * volta com uma indireção em cima.
 *
 * O que é igual em todas — cabeçalho grudado, altura de linha, rolagem
 * horizontal, número alinhado, linha clicável — mora aqui. Por isso o estilo é
 * global e presa a `mer-table`: ele precisa alcançar o `<td>` que a página
 * escreveu, do outro lado da projeção.
 */
@Component({
  selector: 'mer-table',
  standalone: true,
  template: `<div class="mer-table-scroll mer-scroll"><ng-content /></div>`,
  styleUrl: './table.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'mer-table',
    '[class.is-plain]': '!sticky()',
  },
})
export class MerTable {
  /**
   * Cabeçalho grudado no topo durante a rolagem. Ligado por padrão: numa lista
   * de vinte linhas, saber qual coluna é qual sem voltar ao topo é a diferença
   * entre ler e adivinhar.
   */
  readonly sticky = input(true, { transform: booleanAttribute });
}
