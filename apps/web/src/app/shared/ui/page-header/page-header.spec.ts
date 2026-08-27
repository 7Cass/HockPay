import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PageHeader } from './page-header';

@Component({
  standalone: true,
  imports: [PageHeader],
  template: `
    <app-page-header
      [eyebrow]="eyebrow"
      heading="Clientes"
      [description]="description"
      [backTo]="backTo"
      backLabel="Voltar para comprovantes"
    >
      <span pageStatus class="chip" data-tone="ok">Ativo</span>
      <button pageActions type="button" class="btn btn-quiet">Atualizar</button>
    </app-page-header>
  `,
})
class Host {
  eyebrow?: string;
  description?: string;
  backTo?: string;
}

describe('PageHeader', () => {
  async function render(setup: Partial<Host> = {}) {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(Host);
    Object.assign(fixture.componentInstance, setup);
    await fixture.whenStable();

    return fixture.nativeElement as HTMLElement;
  }

  it('renders the heading and projects status and actions', async () => {
    const el = await render();

    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Clientes');
    expect(el.querySelector('[pageStatus]')?.textContent?.trim()).toBe('Ativo');
    expect(el.querySelector('.page-head-actions [pageActions]')).toBeTruthy();
  });

  it('omits eyebrow, description and back link until they are given', async () => {
    const el = await render();

    expect(el.querySelector('.eyebrow')).toBeNull();
    expect(el.querySelector('.page-desc')).toBeNull();
    expect(el.querySelector('.back')).toBeNull();
  });

  it('shows the back link with its label once backTo is set', async () => {
    const el = await render({
      backTo: '/dashboard/receipts',
      eyebrow: 'Loja · Ateliê Corvo',
      description: 'Pagadores identificados por externalId.',
    });

    const back = el.querySelector('.back');
    expect(back?.getAttribute('href')).toBe('/dashboard/receipts');
    expect(back?.textContent).toContain('Voltar para comprovantes');
    expect(el.querySelector('.eyebrow')?.textContent?.trim()).toBe('Loja · Ateliê Corvo');
    expect(el.querySelector('.page-desc')?.textContent?.trim()).toBe(
      'Pagadores identificados por externalId.',
    );
  });
});
