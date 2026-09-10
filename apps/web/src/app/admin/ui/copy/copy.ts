import { Component, input, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy } from '@ng-icons/lucide';

/**
 * Copiar um identificador sem selecionar caractere por caractere.
 *
 *   <adm-copy [value]="payment.id" />
 *   <adm-copy [value]="store.slug" label="Copiar slug" />
 *
 * Numa mesa, todo identificador acaba num chamado, num Slack ou numa consulta
 * ao banco. O botão vive escondido até o ponteiro passar pela linha — a lista
 * não precisa de um ícone aceso por linha para lembrar que dá para copiar.
 */
@Component({
  selector: 'adm-copy',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideCheck, lucideCopy })],
  template: `
    <button
      type="button"
      [attr.aria-label]="copied() ? 'Copiado' : label()"
      [title]="copied() ? 'Copiado' : label()"
      (click)="copy($event)"
    >
      <ng-icon
        [name]="copied() ? 'lucideCheck' : 'lucideCopy'"
        size="12px"
        strokeWidth="1.8"
        aria-hidden="true"
      />
    </button>
  `,
  styleUrl: './copy.css',
  host: { class: 'adm-copy', '[class.is-copied]': 'copied()' },
})
export class AdmCopy {
  readonly value = input.required<string>();

  readonly label = input('Copiar');

  protected readonly copied = signal(false);

  protected copy(event: MouseEvent): void {
    /* O botão quase sempre mora dentro de uma linha clicável. Copiar não é
       abrir. */
    event.stopPropagation();
    event.preventDefault();

    /* Sem `clipboard` (http sem TLS, jsdom) não há o que fazer, e não há o que
       dizer: o valor continua na tela, selecionável. */
    const clipboard = navigator.clipboard;
    if (!clipboard) return;

    void clipboard.writeText(this.value()).then(
      () => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 1400);
      },
      () => {
        /* Permissão negada cai aqui e também não tem conserto pelo operador. */
      },
    );
  }
}
