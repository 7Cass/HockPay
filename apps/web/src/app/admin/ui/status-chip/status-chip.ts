import { Component, computed, input } from '@angular/core';
import { type Tone, statusLabel, statusTone } from '../tone';

/**
 * O status de qualquer coisa, no tom certo.
 *
 *   <adm-status-chip [status]="payment.status" />
 *   <adm-status-chip status="LIVE" label="Ambiente LIVE" tone="info" />
 *
 * O host é a própria pílula — não há elemento a mais entre a célula e o chip.
 */
@Component({
  selector: 'adm-status-chip',
  standalone: true,
  template: '{{ text() }}',
  host: {
    class: 'adm-chip',
    '[attr.data-tone]': 'chipTone()',
  },
})
export class AdmStatusChip {
  readonly status = input.required<string>();

  /** Sobrescreve o rótulo quando a tela tem um nome melhor para o estado. */
  readonly label = input<string>();

  /**
   * Sobrescreve o tom. Existe porque a mesma palavra muda de sentido conforme
   * o domínio: um produto `ACTIVE` está de pé, um link `ACTIVE` só está à
   * espera de alguém pagar.
   */
  readonly tone = input<Tone>();

  protected readonly chipTone = computed(() => this.tone() ?? statusTone(this.status()));

  protected readonly text = computed(() => this.label() ?? statusLabel(this.status()));
}
