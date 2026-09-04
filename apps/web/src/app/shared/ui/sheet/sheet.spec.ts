import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Sheet } from './sheet';

@Component({
  standalone: true,
  imports: [Sheet],
  template: `
    <app-sheet [open]="open()" [side]="side()" (closed)="closes = closes + 1" heading="Solicitar saque">
      <p class="body">corpo</p>
      <button sheetActions type="button">Confirmar</button>
    </app-sheet>
  `,
})
class Host {
  readonly open = signal(false);
  readonly side = signal<'right' | 'center'>('right');
  closes = 0;
}

describe('Sheet', () => {
  function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      host: fixture.componentInstance,
      dialog: element.querySelector('dialog') as HTMLDialogElement,
      element,
    };
  }

  it('stays shut until asked to open', () => {
    const { dialog } = render();

    expect(dialog.open).toBe(false);
  });

  it('opens as a modal and projects both slots', () => {
    const { fixture, host, dialog, element } = render();

    host.open.set(true);
    fixture.detectChanges();

    expect(dialog.open).toBe(true);
    expect(element.querySelector('.sheet-body .body')?.textContent).toBe('corpo');
    expect(element.querySelector('.sheet-foot button')?.textContent).toContain('Confirmar');
  });

  it('closes when the caller lowers the flag', () => {
    const { fixture, host, dialog } = render();

    host.open.set(true);
    fixture.detectChanges();
    host.open.set(false);
    fixture.detectChanges();

    expect(dialog.open).toBe(false);
  });

  /* Escape e o X passam pelo mesmo `close` nativo, então um teste cobre os dois. */
  it('tells the caller when the browser closes it', () => {
    const { fixture, host, dialog } = render();

    host.open.set(true);
    fixture.detectChanges();
    dialog.dispatchEvent(new Event('close'));
    fixture.detectChanges();

    expect(host.closes).toBe(1);
  });

  it('carries the side so the stylesheet can place it', () => {
    const { fixture, host, dialog } = render();

    expect(dialog.getAttribute('data-side')).toBe('right');

    host.side.set('center');
    fixture.detectChanges();

    expect(dialog.getAttribute('data-side')).toBe('center');
  });

  it('locks the page behind it and lets go on close', () => {
    const { fixture, host } = render();

    host.open.set(true);
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('hidden');

    host.open.set(false);
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('');
  });
});
