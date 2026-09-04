import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Pagination } from './pagination';

@Component({
  standalone: true,
  imports: [Pagination],
  template: `
    <app-pagination
      [page]="page()"
      [totalPages]="totalPages()"
      [total]="total()"
      [shown]="shown()"
      noun="clientes"
      (pageChange)="requested.push($event)"
    />
  `,
})
class Host {
  readonly page = signal(2);
  readonly totalPages = signal(5);
  readonly total = signal(96);
  readonly shown = signal(20);
  readonly requested: number[] = [];
}

describe('Pagination', () => {
  async function render() {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const el = () => fixture.nativeElement as HTMLElement;

    return {
      host: fixture.componentInstance,
      el,
      buttons: () => Array.from(el().querySelectorAll('button')) as HTMLButtonElement[],
      settle: async () => {
        await fixture.whenStable();
      },
    };
  }

  it('says how much of how much is on screen', async () => {
    const { el } = await render();

    expect(el().querySelector('.count')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Exibindo 20 de 96 clientes',
    );
    expect(el().querySelector('.page')?.textContent?.trim()).toBe('2 / 5');
  });

  it('emits the destination page, not a delta', async () => {
    const { host, buttons } = await render();
    const [previous, next] = buttons();

    next.click();
    previous.click();

    expect(host.requested).toEqual([3, 1]);
  });

  it('disables the edges so it can never ask for a page outside the range', async () => {
    const { host, buttons, settle } = await render();

    host.page.set(1);
    await settle();
    expect(buttons()[0].disabled).toBe(true);
    expect(buttons()[1].disabled).toBe(false);

    host.page.set(5);
    await settle();
    expect(buttons()[0].disabled).toBe(false);
    expect(buttons()[1].disabled).toBe(true);
  });

  it('survives an empty list, where the API reports zero pages', async () => {
    const { host, el, buttons, settle } = await render();

    host.page.set(1);
    host.totalPages.set(0);
    host.total.set(0);
    host.shown.set(0);
    await settle();

    expect(el().querySelector('.page')?.textContent?.trim()).toBe('1 / 1');
    expect(buttons()[0].disabled).toBe(true);
    expect(buttons()[1].disabled).toBe(true);
  });
});
