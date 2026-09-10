import { Component } from '@angular/core';

/**
 * Uma tecla, desenhada como tecla.
 *
 *   <adm-kbd>⌘</adm-kbd><adm-kbd>K</adm-kbd>
 *
 * Existe porque atalho que não aparece na tela não é atalho: é folclore que um
 * operador conta para o outro. Onde a mesa tem caminho de teclado, a tecla fica
 * escrita ao lado do caminho de mouse.
 */
@Component({
  selector: 'adm-kbd',
  standalone: true,
  template: '<ng-content />',
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.125rem;
        height: 1.125rem;
        padding: 0 0.25rem;
        border: 1px solid var(--adm-line-strong);
        border-bottom-width: 2px;
        border-radius: 4px;
        background: var(--adm-surface);
        font-family: var(--font-code);
        font-size: 10px;
        line-height: 1;
        color: var(--adm-text-2);
      }
    `,
  ],
})
export class AdmKbd {}
