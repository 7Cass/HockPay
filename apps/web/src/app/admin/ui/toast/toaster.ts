import { Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideInfo, lucideTriangleAlert, lucideX } from '@ng-icons/lucide';

import { AdmToastService } from './toast.service';
import type { Tone } from '../tone';

const ICON: Record<Tone, string> = {
  ok: 'lucideCheck',
  bad: 'lucideTriangleAlert',
  warn: 'lucideTriangleAlert',
  info: 'lucideInfo',
  neutral: 'lucideInfo',
};

/**
 * Onde os avisos aparecem. Montado uma vez, no shell e na porta de entrada.
 *
 *   <adm-toaster />
 *
 * Canto inferior direito, longe da coluna de navegação e do cabeçalho — os dois
 * lugares onde o operador clica sem olhar. `aria-live="polite"` porque o aviso
 * conta o que já aconteceu: interromper a leitura para anunciar um sucesso é
 * pior do que esperar a próxima pausa.
 */
@Component({
  selector: 'adm-toaster',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideCheck, lucideInfo, lucideTriangleAlert, lucideX })],
  template: `
    @for (toast of toasts.toasts(); track toast.id) {
      <div class="toast" [attr.data-tone]="toast.tone">
        <ng-icon [name]="icon(toast.tone)" size="14px" strokeWidth="2" aria-hidden="true" />

        <div class="text">
          <span class="message">{{ toast.message }}</span>
          @if (toast.detail) {
            <span class="detail">{{ toast.detail }}</span>
          }
        </div>

        <button type="button" class="close" (click)="toasts.dismiss(toast.id)" aria-label="Fechar">
          <ng-icon name="lucideX" size="13px" strokeWidth="2" />
        </button>
      </div>
    }
  `,
  styleUrl: './toaster.css',
  host: {
    class: 'adm-toaster',
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'false',
  },
})
export class AdmToaster {
  protected readonly toasts = inject(AdmToastService);

  protected icon(tone: Tone): string {
    return ICON[tone];
  }
}
