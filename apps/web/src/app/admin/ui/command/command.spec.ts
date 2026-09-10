import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AdmCommandPalette, type AdmCommand } from './command';

@Component({
  standalone: true,
  imports: [AdmCommandPalette],
  template: `
    <adm-command-palette
      [open]="open()"
      [commands]="commands()"
      (queryChange)="query.set($event)"
      (closed)="open.set(false)"
    />
  `,
})
class Host {
  readonly open = signal(true);
  readonly query = signal('');
  readonly ran = signal<string[]>([]);

  readonly commands = signal<readonly AdmCommand[]>([
    {
      id: 'queue',
      group: 'Ir para',
      label: 'Fila',
      hint: 'quem pede decisão',
      run: () => this.ran.update((list) => [...list, 'queue']),
    },
    {
      id: 'trail',
      group: 'Ir para',
      label: 'Trilha',
      run: () => this.ran.update((list) => [...list, 'trail']),
    },
    {
      id: 'theme',
      group: 'Preferências',
      label: 'Alternar tema',
      keywords: 'claro escuro',
      run: () => this.ran.update((list) => [...list, 'theme']),
    },
  ]);
}

describe('AdmCommandPalette', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;

    return {
      host: fixture.componentInstance,
      field: el.querySelector<HTMLInputElement>('.search input')!,
      options: () => Array.from(el.querySelectorAll<HTMLButtonElement>('.list button')),
      groups: () =>
        Array.from(el.querySelectorAll('.group > .adm-overline')).map((span) =>
          span.textContent!.trim(),
        ),
      type: async (value: string) => {
        const field = el.querySelector<HTMLInputElement>('.search input')!;
        field.value = value;
        field.dispatchEvent(new Event('input'));
        fixture.detectChanges();
        await fixture.whenStable();
      },
      press: async (key: string) => {
        el.querySelector<HTMLInputElement>('.search input')!.dispatchEvent(
          new KeyboardEvent('keydown', { key }),
        );
        fixture.detectChanges();
        await fixture.whenStable();
      },
    };
  }

  it('lists everything under its group before anything is typed', async () => {
    const { options, groups } = await render();

    expect(groups()).toEqual(['Ir para', 'Preferências']);
    expect(options()).toHaveLength(3);
  });

  it('finds by label, by group and by keyword, without accents mattering', async () => {
    const { options, type } = await render();

    await type('trilha');
    expect(options().map((option) => option.textContent!.trim())).toEqual(['Trilha']);

    await type('PREFERENCIAS');
    expect(options().map((option) => option.textContent!.trim())).toEqual(['Alternar tema']);

    await type('escuro');
    expect(options().map((option) => option.textContent!.trim())).toEqual(['Alternar tema']);
  });

  /*
   * A paleta não conhece loja nem rota: quem oferece "abrir loja <id>" é o
   * shell, e ele só consegue por causa deste evento.
   */
  it('reports what is typed, so the caller can offer a command for it', async () => {
    const { host, type } = await render();

    await type('store-42');

    expect(host.query()).toBe('store-42');
  });

  it('runs the highlighted command with the keyboard, and closes before running it', async () => {
    const { host, press } = await render();

    await press('ArrowDown');
    await press('Enter');

    expect(host.ran()).toEqual(['trail']);
    expect(host.open()).toBe(false);
  });

  it('does nothing on Enter when nothing matches', async () => {
    const { host, type, press, options } = await render();

    await type('não existe');
    expect(options()).toHaveLength(0);

    await press('Enter');
    expect(host.ran()).toEqual([]);
  });
});
