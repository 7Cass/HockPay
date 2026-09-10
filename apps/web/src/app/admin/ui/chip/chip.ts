import { Component, booleanAttribute, input } from '@angular/core';

import type { Tone } from '../tone';

/**
 * O chip de estado.
 *
 *   <adm-chip tone="ok">Aprovada</adm-chip>
 *   <adm-chip tone="neutral" [dot]="false" class="adm-mono">refund</adm-chip>
 *
 * Ponto mais texto num fundo lavado — não pílula sólida. Numa tabela de trinta
 * linhas, trinta pílulas saturadas viram um vitral e nenhuma se destaca; o ponto
 * carrega a cor num pixel e deixa o texto legível.
 *
 * `dot="false"` é para quando o chip carrega um enum técnico e não um estado (o
 * `type` de uma transação, por exemplo): o ponto ali prometeria uma leitura de
 * saúde que aquele valor não tem.
 */
@Component({
  selector: 'adm-chip',
  standalone: true,
  template: `
    @if (dot()) {
      <span class="dot" aria-hidden="true"></span>
    }
    <ng-content />
  `,
  styleUrl: './chip.css',
  host: {
    class: 'adm-chip',
    '[attr.data-tone]': 'tone()',
  },
})
export class AdmChip {
  readonly tone = input<Tone>('neutral');

  readonly dot = input(true, { transform: booleanAttribute });
}
