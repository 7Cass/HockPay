import { Component, ViewEncapsulation, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideInfo, lucideTriangleAlert } from '@ng-icons/lucide';

import type { Tone } from '../tone';

const ICON: Partial<Record<Tone, string>> = {
  warn: 'lucideTriangleAlert',
  bad: 'lucideCircleAlert',
  info: 'lucideInfo',
};

/**
 * O aviso que fica na tela — não o que passa.
 *
 *   <adm-notice tone="warn">
 *     <strong>Encurtar o prazo antecipa a liberação.</strong> O prazo é promessa
 *     da loja, não do pagamento.
 *   </adm-notice>
 *
 * Faixa com filete colorido à esquerda: é o filete que deixa o aviso
 * reconhecível de longe sem pintar o bloco inteiro de cor. A regra de casa vale
 * aqui — a cor diz estado, e um aviso é estado.
 *
 * A diferença para o toast é de duração e de dono: o toast conta o que a mesa
 * acabou de fazer e some; o aviso conta uma condição da tela, e some quando a
 * condição sai.
 */
@Component({
  selector: 'adm-notice',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideCircleAlert, lucideInfo, lucideTriangleAlert })],
  template: `
    @if (iconName(); as name) {
      <ng-icon [name]="name" size="14px" strokeWidth="1.8" aria-hidden="true" />
    }
    <span class="text"><ng-content /></span>
  `,
  styleUrl: './notice.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'adm-notice',
    '[attr.data-tone]': 'tone()',
    role: 'note',
  },
})
export class AdmNotice {
  readonly tone = input<Tone>('neutral');

  /** Cada tom tem o seu ícone; `icon=""` tira o ícone sem tirar o filete. */
  readonly icon = input<string>();

  protected iconName(): string | undefined {
    return this.icon() ?? ICON[this.tone()];
  }
}
