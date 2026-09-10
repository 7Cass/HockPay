import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AdmSegmented, type AdmSegmentedOption } from './segmented';

type Filter = 'PENDING' | 'APPROVED' | 'all';

const OPTIONS: readonly AdmSegmentedOption<Filter>[] = [
  { value: 'PENDING', label: 'Pendentes', count: 3 },
  { value: 'APPROVED', label: 'Aprovadas' },
  { value: 'all', label: 'Todas' },
];

@Component({
  standalone: true,
  imports: [AdmSegmented],
  template: `
    <adm-segmented
      [options]="options"
      [value]="value()"
      (valueChange)="value.set($event)"
      ariaLabel="Estado"
    />
  `,
})
class Host {
  readonly options = OPTIONS;
  readonly value = signal<Filter>('PENDING');
}

describe('AdmSegmented', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;

    return {
      host: fixture.componentInstance,
      buttons: () => Array.from(el.querySelectorAll<HTMLButtonElement>('adm-segmented button')),
      settle: async () => {
        fixture.detectChanges();
        await fixture.whenStable();
      },
    };
  }

  it('shows the alternatives together with the choice', async () => {
    const { buttons } = await render();

    expect(buttons().map((button) => button.textContent!.trim())).toEqual([
      'Pendentes 3',
      'Aprovadas',
      'Todas',
    ]);
    expect(buttons()[0].getAttribute('aria-selected')).toBe('true');
    expect(buttons()[1].getAttribute('aria-selected')).toBe('false');
  });

  it('reports the choice instead of keeping it', async () => {
    const { host, buttons, settle } = await render();

    buttons()[2].click();
    await settle();

    expect(host.value()).toBe('all');
    expect(buttons()[2].classList.contains('is-active')).toBe(true);
  });

  /*
   * Um controle que só responde a Tab obriga a passar por todas as opções para
   * chegar na última — e numa mesa isso é o filtro inteiro, todo dia.
   */
  it('walks with the arrows, and wraps around', async () => {
    const { host, buttons, settle } = await render();

    buttons()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await settle();
    expect(host.value()).toBe('APPROVED');

    buttons()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await settle();
    expect(host.value()).toBe('all');
  });
});
