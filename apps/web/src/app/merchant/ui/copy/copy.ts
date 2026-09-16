import { Component, computed, input, signal } from '@angular/core';

/**
 * Um identificador que se copia.
 *
 *   <mer-copy [value]="payment.id" [truncate]="12" />
 *
 * Existe porque metade do trabalho de investigar uma cobrança é levar um id
 * para outro lugar — o chamado, o log, o `curl`. Mostrar o id inteiro rouba a
 * linha; mostrar cortado sem poder copiar obriga a abrir o inspetor.
 *
 * O aviso de copiado volta sozinho depois de um segundo e meio, e o botão diz
 * o que faz por `aria-label`, não só pela mudança de texto.
 */
@Component({
  selector: 'mer-copy',
  standalone: true,
  template: `
    <button
      type="button"
      class="copy"
      [attr.aria-label]="copied() ? 'Copiado' : 'Copiar ' + value()"
      [title]="value() || ''"
      [disabled]="!value()"
      (click)="copy()"
    >
      <span class="mer-mono">{{ shown() }}</span>
      <span class="mark" aria-hidden="true">{{ copied() ? '✓' : '⧉' }}</span>
    </button>
  `,
  styleUrl: './copy.css',
  host: { class: 'mer-copy' },
})
export class MerCopy {
  readonly value = input<string | null | undefined>('');

  /** Quantos caracteres do começo ficam visíveis. `0` mostra inteiro. */
  readonly truncate = input(12);

  protected readonly copied = signal(false);

  protected readonly shown = computed(() => {
    const value = this.value() ?? '';
    if (!value) return '—';

    const limit = this.truncate();
    return limit > 0 && value.length > limit ? `${value.slice(0, limit)}…` : value;
  });

  protected copy(): void {
    const value = this.value();
    if (!value) return;

    // `clipboard` não existe em contexto inseguro nem no jsdom: copiar é um
    // conforto, e a falta dele não pode derrubar a tela.
    void navigator.clipboard?.writeText(value);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1500);
  }
}
