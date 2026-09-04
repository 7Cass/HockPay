import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PageState, type PageStateVariant } from './page-state';

@Component({
  standalone: true,
  imports: [PageState],
  template: `
    <app-page-state
      [variant]="variant()"
      [heading]="heading()"
      [message]="message()"
      [frame]="frame()"
    >
      @if (withAction()) {
        <button pageStateAction type="button" class="btn btn-quiet">Limpar busca</button>
      }
    </app-page-state>
  `,
})
class Host {
  readonly variant = signal<PageStateVariant>('loading');
  readonly heading = signal<string | undefined>(undefined);
  readonly message = signal<string | undefined>(undefined);
  readonly frame = signal<'panel' | 'bare'>('panel');
  readonly withAction = signal(false);
}

describe('PageState', () => {
  async function render() {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();

    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    return {
      host: fixture.componentInstance,
      state: () => fixture.nativeElement.querySelector('app-page-state') as HTMLElement,
      settle: async () => {
        await fixture.whenStable();
      },
    };
  }

  it('spins and announces itself as busy while loading', async () => {
    const { state } = await render();

    expect(state().getAttribute('aria-busy')).toBe('true');
    expect(state().querySelector('.spinner')).toBeTruthy();
    expect(state().querySelector('p')?.textContent?.trim()).toBe('Carregando…');
  });

  it('falls back to a default heading per variant and keeps a given one', async () => {
    const { host, state, settle } = await render();

    host.variant.set('empty');
    await settle();
    expect(state().querySelector('h3')?.textContent?.trim()).toBe('Nada por aqui ainda');

    host.variant.set('error');
    await settle();
    expect(state().getAttribute('aria-busy')).toBe('false');
    expect(state().querySelector('h3')?.textContent?.trim()).toBe('Não foi possível carregar');

    host.heading.set('Nenhum cliente encontrado');
    host.message.set('Nenhum cliente corresponde à busca.');
    await settle();
    expect(state().querySelector('h3')?.textContent?.trim()).toBe('Nenhum cliente encontrado');
    expect(state().querySelector('p')?.textContent?.trim()).toBe(
      'Nenhum cliente corresponde à busca.',
    );
  });

  it('drops the frame on demand and projects an action', async () => {
    const { host, state, settle } = await render();

    host.variant.set('empty');
    host.frame.set('bare');
    host.withAction.set(true);
    await settle();

    expect(state().classList.contains('is-bare')).toBe(true);
    expect(state().querySelector('.state-action [pageStateAction]')).toBeTruthy();
  });
});
