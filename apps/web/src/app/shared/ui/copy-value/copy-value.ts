import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy } from '@ng-icons/lucide';

/**
 * Um identificador que se copia sozinho.
 *
 *   <app-copy-value [value]="payment.id" />
 *   <app-copy-value [value]="link.checkoutUrl" label="Copiar link" />
 *   <app-copy-value [value]="withdrawal.pixE2eId" [truncate]="12" />
 *
 * As telas de detalhe estão cheias de uuid, chave Pix e E2E — coisas que
 * existem para ir parar em outro lugar. Cada tela reimplementava o mesmo
 * `copy()` com o mesmo timer; agora o botão cuida disso.
 *
 * Sem valor, vira um travessão: nada para copiar, nada para clicar.
 */
@Component({
  selector: 'app-copy-value',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideCheck, lucideCopy })],
  templateUrl: './copy-value.html',
  styleUrl: './copy-value.css',
})
export class CopyValue {
  readonly value = input.required<string | null | undefined>();

  /** Texto no lugar do valor. Sem isso, mostra o próprio valor. */
  readonly label = input<string>();

  /** Corta o valor exibido; o que vai para a área de transferência é inteiro. */
  readonly truncate = input(0);

  protected readonly copied = signal(false);

  protected readonly text = computed(() => {
    const label = this.label();
    if (label) return label;

    const value = this.value() ?? '';
    const limit = this.truncate();
    return limit > 0 && value.length > limit ? `${value.slice(0, limit)}…` : value;
  });

  private timer?: number;

  constructor() {
    inject(DestroyRef).onDestroy(() => window.clearTimeout(this.timer));
  }

  protected copy(): void {
    const value = this.value();
    if (!value) return;

    void navigator.clipboard?.writeText(value);
    this.copied.set(true);
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.copied.set(false), 1500);
  }
}
