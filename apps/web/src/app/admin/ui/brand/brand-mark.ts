import { Component, input } from '@angular/core';

/**
 * O selo da casa: duas barras e um ponto.
 *
 *   <adm-brand-mark />
 *   <adm-brand-mark size="lg" />
 *
 * As barras são as pernas do "h" de hockpay; o ponto é o mesmo pingo que, no
 * lojista, marca um pagamento confirmado. Aqui ele não significa nada além de
 * assinatura — e é a única peça de marca que a mesa carrega.
 *
 * Existe como componente porque aparece em dois lugares que nunca estão na tela
 * ao mesmo tempo — a coluna e a porta de entrada —, e um selo que se desenha
 * duas vezes acaba com dois pixels de diferença entre as duas.
 */
@Component({
  selector: 'adm-brand-mark',
  standalone: true,
  template: `
    <span class="bar"></span>
    <span class="bar"></span>
    <span class="dot"></span>
  `,
  styleUrl: './brand-mark.css',
  host: {
    'aria-hidden': 'true',
    '[attr.data-size]': 'size()',
  },
})
export class AdmBrandMark {
  readonly size = input<'md' | 'lg'>('md');
}
