import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AdmMenu } from './menu';

@Component({
  standalone: true,
  imports: [AdmMenu],
  template: `
    <adm-menu side="top">
      <button type="button" menuTrigger>Ana Mesa</button>
      <div menuItems>
        <button type="button" class="leave" (click)="left.set(true)">Sair</button>
      </div>
    </adm-menu>
    <button type="button" class="outside">fora</button>
  `,
})
class Host {
  readonly left = signal(false);
}

describe('AdmMenu', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;

    return {
      host: fixture.componentInstance,
      trigger: el.querySelector<HTMLButtonElement>('[menuTrigger]')!,
      panel: () => el.querySelector('.panel'),
      leave: () => el.querySelector<HTMLButtonElement>('.leave'),
      outside: el.querySelector<HTMLButtonElement>('.outside')!,
      settle: async () => {
        fixture.detectChanges();
        await fixture.whenStable();
      },
    };
  }

  it('keeps the items out of the DOM until the trigger is used', async () => {
    const { trigger, panel, settle } = await render();

    expect(panel()).toBeNull();

    trigger.click();
    await settle();

    expect(panel()).not.toBeNull();
  });

  it('closes when an item is chosen, because choosing is the end of the menu', async () => {
    const { host, trigger, panel, leave, settle } = await render();

    trigger.click();
    await settle();
    leave()!.click();
    await settle();

    expect(host.left()).toBe(true);
    expect(panel()).toBeNull();
  });

  it('closes on a click outside it', async () => {
    const { trigger, panel, outside, settle } = await render();

    trigger.click();
    await settle();

    outside.click();
    await settle();

    expect(panel()).toBeNull();
  });
});
