import { Component, ElementRef, ViewEncapsulation, inject, input, signal } from '@angular/core';

/**
 * O menu que sai de um botão.
 *
 *   <adm-menu align="start" side="top">
 *     <button menuTrigger admButton variant="ghost">Ana Mesa</button>
 *     <div menuItems>
 *       <button type="button" (click)="theme.toggleTheme()">Tema escuro</button>
 *       <button type="button" (click)="logout()">Sair</button>
 *     </div>
 *   </adm-menu>
 *
 * Os itens são `<button>` da página, projetados: o menu da mesa tem itens que
 * alternam estado (tema, densidade) e itens que executam (sair), e uma API de
 * `[items]` com `type: 'toggle' | 'action'` termina reinventando o botão com
 * menos poder do que ele já tem. O que o componente carrega é o que ninguém
 * lembra de fazer: fechar no clique fora, fechar no Escape, fechar depois de
 * escolher, e devolver o foco para o gatilho.
 */
@Component({
  selector: 'adm-menu',
  standalone: true,
  template: `
    <div class="trigger" (click)="toggle()">
      <ng-content select="[menuTrigger]" />
    </div>

    @if (open()) {
      <div class="panel" role="menu" [attr.data-align]="align()" [attr.data-side]="side()">
        <ng-content select="[menuItems]" />
      </div>
    }
  `,
  styleUrl: './menu.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'adm-menu',
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'close()',
    '(click)': 'onInsideClick($event)',
  },
})
export class AdmMenu {
  /** Encosta o painel no começo ou no fim do gatilho. */
  readonly align = input<'start' | 'end'>('start');

  /** `top` para gatilho que mora no rodapé da coluna; `bottom` para o resto. */
  readonly side = input<'top' | 'bottom'>('bottom');

  protected readonly open = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected toggle(): void {
    this.open.update((value) => !value);
  }

  close(): void {
    this.open.set(false);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  /**
   * Escolher fecha. O clique num item borbulha até aqui, e o único clique de
   * dentro que não deve fechar é o do próprio gatilho — que já fechou, porque
   * `toggle` roda antes.
   */
  protected onInsideClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('[menuItems]')) this.close();
  }
}
