import { Component, computed, input } from '@angular/core';

import { AdmChip } from '../chip/chip';
import { type Tone, statusLabel, statusTone } from '../tone';

/**
 * O status de qualquer coisa, no tom certo.
 *
 *   <adm-status-chip [status]="payment.status" />
 *   <adm-status-chip status="LIVE" label="Ambiente LIVE" tone="info" />
 *
 * É o `adm-chip` mais o vocabulário: quem escreve a tela passa o enum cru que
 * veio da API e não decide cor nem tradução — decidir isso na tela é como um
 * status novo ganha três cores diferentes em três telas diferentes.
 *
 * O host é `display: contents`, então na página o chip é filho direto do `<td>`:
 * nada muda de alinhamento por existir um componente no meio.
 */
@Component({
  selector: 'adm-status-chip',
  standalone: true,
  imports: [AdmChip],
  template: `<adm-chip [tone]="chipTone()">{{ text() }}</adm-chip>`,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class AdmStatusChip {
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
