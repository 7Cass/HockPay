import { Component, computed, input } from '@angular/core';

/**
 * O crachá do operador, reduzido a duas letras.
 *
 *   <adm-avatar [name]="operator().name" />
 *
 * Não há foto no domínio — `Operator` tem nome e e-mail — e inventar uma
 * silhueta genérica só ocuparia o mesmo espaço dizendo menos. As iniciais
 * respondem a pergunta que a mesa faz de verdade: com qual crachá eu estou
 * assinando o que estou decidindo.
 */
@Component({
  selector: 'adm-avatar',
  standalone: true,
  template: '{{ initials() }}',
  styles: [
    `
      :host {
        display: grid;
        place-items: center;
        flex: none;
        width: 1.75rem;
        height: 1.75rem;
        border-radius: var(--adm-radius-sm);
        background: var(--adm-surface-3);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.01em;
        color: var(--adm-text-2);
      }

      :host([data-size='lg']) {
        width: 2.25rem;
        height: 2.25rem;
        font-size: 12.5px;
      }
    `,
  ],
  host: {
    'aria-hidden': 'true',
    '[attr.data-size]': 'size()',
  },
})
export class AdmAvatar {
  readonly name = input<string | undefined>();

  readonly size = input<'md' | 'lg'>('md');

  protected readonly initials = computed(() => {
    const name = this.name();
    if (!name) return '·';

    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]!.toUpperCase())
        .join('') || '·'
    );
  });
}
