import { Component, booleanAttribute, input } from '@angular/core';

/**
 * Pares rótulo/valor — a forma de ler uma entidade sem inventar uma tabela de
 * uma linha só.
 *
 *   <adm-facts>
 *     <adm-fact label="Estado da loja">Ativa</adm-fact>
 *     <adm-fact label="Disponível" size="lg">R$ 1.204,00</adm-fact>
 *   </adm-facts>
 *
 * A grade se ajusta sozinha à largura: `auto-fit` com mínimo de 11rem, que é o
 * ponto em que "Prazo de liquidação" ainda cabe numa linha só.
 */
@Component({
  selector: 'adm-facts',
  standalone: true,
  template: `<dl><ng-content /></dl>`,
  styleUrl: './facts.css',
  host: { class: 'adm-facts', '[class.is-tight]': 'tight()' },
})
export class AdmFacts {
  /** Colunas mais estreitas, para dentro de um painel modal. */
  readonly tight = input(false, { transform: booleanAttribute });
}

/**
 * Um fato. O host é `display: contents` para o `<div>` de dentro ser o item da
 * grade — e para o `<dl>` continuar com filhos que o HTML aceita.
 */
@Component({
  selector: 'adm-fact',
  standalone: true,
  template: `
    <div class="fact">
      <dt>{{ label() }}</dt>
      <dd><ng-content /></dd>
    </div>
  `,
  styleUrl: './fact.css',
  host: { '[attr.data-size]': 'size()' },
})
export class AdmFact {
  readonly label = input.required<string>();

  /** `lg` para dinheiro: saldo é o que se lê primeiro, e por isso cresce. */
  readonly size = input<'md' | 'lg'>('md');
}
