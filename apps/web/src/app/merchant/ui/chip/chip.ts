import { Component, computed, input } from '@angular/core';

import { type Tone, statusLabel, statusTone } from '../../domain/tone';

/**
 * O estado de qualquer coisa, no tom certo.
 *
 *   <mer-chip [status]="payment.status" />
 *   <mer-chip status="ACTIVE" label="Link ativo" tone="neutral" />
 *
 * O host é a própria pílula — não há elemento a mais entre a célula e o chip.
 */
@Component({
  selector: 'mer-chip',
  standalone: true,
  template: '{{ text() }}',
  styleUrl: './chip.css',
  host: {
    class: 'mer-chip',
    '[attr.data-tone]': 'chipTone()',
  },
})
export class MerChip {
  readonly status = input.required<string>();

  /** Sobrescreve o rótulo quando a tela tem um nome melhor para o estado. */
  readonly label = input<string>();

  /**
   * Sobrescreve o tom. Existe porque a mesma palavra muda de sentido conforme o
   * domínio: um produto `ACTIVE` está de pé, um link `ACTIVE` só está à espera
   * de alguém pagar.
   */
  readonly tone = input<Tone>();

  protected readonly chipTone = computed(() => this.tone() ?? statusTone(this.status()));
  protected readonly text = computed(() => this.label() ?? statusLabel(this.status()));
}
