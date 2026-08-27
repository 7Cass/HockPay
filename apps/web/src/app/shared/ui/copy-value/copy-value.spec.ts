import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CopyValue } from './copy-value';

@Component({
  standalone: true,
  imports: [CopyValue],
  template: '<app-copy-value [value]="value()" [label]="label()" [truncate]="truncate()" />',
})
class Host {
  readonly value = signal<string | null>('wd_1234567890abcdef');
  readonly label = signal<string | undefined>(undefined);
  readonly truncate = signal(0);
}

describe('CopyValue', () => {
  let written: string[];

  beforeEach(() => {
    written = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          written.push(text);
          return Promise.resolve();
        },
      },
    });
  });

  function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, host: fixture.componentInstance, element };
  }

  it('shows the whole value when nothing asks for a cut', () => {
    const { element } = render();

    expect(element.querySelector('.copy-text')?.textContent).toBe('wd_1234567890abcdef');
  });

  it('cuts the shown value but copies it whole', () => {
    const { fixture, host, element } = render();
    host.truncate.set(8);
    fixture.detectChanges();

    expect(element.querySelector('.copy-text')?.textContent).toBe('wd_12345…');

    element.querySelector('button')?.click();
    expect(written).toEqual(['wd_1234567890abcdef']);
  });

  it('lets a label speak for the value', () => {
    const { fixture, host, element } = render();
    host.label.set('Copiar link');
    fixture.detectChanges();

    expect(element.querySelector('.copy-text')?.textContent).toBe('Copiar link');
  });

  it('confirms the copy on the button itself', () => {
    const { fixture, element } = render();

    element.querySelector('button')?.click();
    fixture.detectChanges();

    const button = element.querySelector('button');
    expect(button?.getAttribute('data-state')).toBe('copied');
    expect(button?.getAttribute('title')).toBe('Copiado');
  });

  it('offers nothing to click when there is nothing to copy', () => {
    const { fixture, host, element } = render();
    host.value.set(null);
    fixture.detectChanges();

    expect(element.querySelector('button')).toBeNull();
    expect(element.querySelector('.copy-empty')?.textContent).toBe('—');
  });
});
