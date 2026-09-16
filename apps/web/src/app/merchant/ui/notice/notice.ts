import { Component, input } from '@angular/core';

import type { Tone } from '../../domain/tone';

/**
 * O aviso de uma linha, com o que fazer a respeito.
 *
 *   <mer-notice tone="ok" heading="Saque solicitado">
 *     O saldo já foi reservado.
 *     <button noticeAction merButton size="sm">Abrir detalhe</button>
 *   </mer-notice>
 *
 * Não é o estado de página: aquele substitui o conteúdo, este acompanha. O tom
 * usa o mesmo vocabulário do chip — o lojista não deveria aprender duas
 * gramáticas de cor na mesma tela.
 */
@Component({
  selector: 'mer-notice',
  standalone: true,
  template: `
    <div class="text">
      @if (heading(); as text) {
        <strong>{{ text }}</strong>
      }
      <span><ng-content /></span>
    </div>

    <div class="action">
      <ng-content select="[noticeAction]" />
    </div>
  `,
  styleUrl: './notice.css',
  host: {
    class: 'mer-notice',
    '[attr.data-tone]': 'tone()',
    role: 'status',
  },
})
export class MerNotice {
  readonly tone = input<Tone>('neutral');

  readonly heading = input<string>();
}
