import { Component, inject } from '@angular/core';

import { MerToastService } from './toast.service';

/**
 * Onde os avisos aparecem. Montado uma vez, na casca.
 *
 *   <mer-toaster />
 *
 * Canto inferior direito, longe do trilho e da barra de cima — os dois lugares
 * onde se clica sem olhar. `aria-live="polite"` porque o aviso conta o que já
 * aconteceu: interromper a leitura para anunciar um sucesso é pior do que
 * esperar a próxima pausa.
 */
@Component({
  selector: 'mer-toaster',
  standalone: true,
  template: `
    @for (toast of toasts.toasts(); track toast.id) {
      <div class="toast" [attr.data-tone]="toast.tone">
        <span class="mark" aria-hidden="true">
          @if (toast.tone === 'ok') {
            ✓
          } @else if (toast.tone === 'bad' || toast.tone === 'warn') {
            !
          } @else {
            ·
          }
        </span>

        <div class="text">
          <span class="message">{{ toast.message }}</span>
          @if (toast.detail) {
            <span class="detail">{{ toast.detail }}</span>
          }
        </div>

        <button type="button" class="close" (click)="toasts.dismiss(toast.id)" aria-label="Fechar">
          ×
        </button>
      </div>
    }
  `,
  styleUrl: './toaster.css',
  host: {
    class: 'mer-toaster',
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'false',
  },
})
export class MerToaster {
  protected readonly toasts = inject(MerToastService);
}
