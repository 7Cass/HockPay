import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AdmButton } from './button';

@Component({
  standalone: true,
  imports: [AdmButton],
  template: `
    <button admButton [variant]="variant()" [loading]="loading()" [disabled]="disabled()">
      Aprovar
    </button>
  `,
})
class Host {
  readonly variant = signal<'primary' | 'quiet'>('quiet');
  readonly loading = signal(false);
  readonly disabled = signal(false);
}

describe('AdmButton', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    return {
      host: fixture.componentInstance,
      button: fixture.nativeElement.querySelector('button') as HTMLButtonElement,
      settle: async () => {
        fixture.detectChanges();
        await fixture.whenStable();
      },
    };
  }

  it('puts the skin on the native element, without wrapping it', async () => {
    const { button, host, settle } = await render();

    expect(button.classList.contains('adm-btn')).toBe(true);
    expect(button.getAttribute('data-variant')).toBe('quiet');

    host.variant.set('primary');
    await settle();

    expect(button.getAttribute('data-variant')).toBe('primary');
  });

  /*
   * A regressão que este teste guarda: quando o `disabled` era escrito como
   * atributo pelo componente e como propriedade pela página, a última escrita
   * ganhava — e o botão da página voltava a aceitar clique.
   */
  it('combines the page disabled with its own loading, instead of one erasing the other', async () => {
    const { button, host, settle } = await render();

    expect(button.disabled).toBe(false);

    host.disabled.set(true);
    await settle();
    expect(button.disabled).toBe(true);

    host.disabled.set(false);
    host.loading.set(true);
    await settle();
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('shows the spin without dropping the label', async () => {
    const { button, host, settle } = await render();

    host.loading.set(true);
    await settle();

    expect(button.querySelector('.spin')).not.toBeNull();
    expect(button.textContent?.trim()).toBe('Aprovar');
  });
});
