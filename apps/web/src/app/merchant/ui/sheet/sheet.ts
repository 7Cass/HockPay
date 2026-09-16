import {
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

/**
 * A folha: painel lateral para formulário, centrado para uma decisão.
 *
 *   <mer-sheet [open]="open()" heading="Solicitar saque" (closed)="close()">
 *     <mer-field label="Valor">…</mer-field>
 *     <ng-container sheetActions>
 *       <button merButton (click)="close()">Cancelar</button>
 *       <button merButton variant="primary">Confirmar</button>
 *     </ng-container>
 *   </mer-sheet>
 *
 * Por baixo é um `<dialog>` nativo: foco preso, Escape, camada de topo e
 * inércia do resto da página vêm do navegador, e não de uma biblioteca. É a
 * mesma escolha do `AdmSheet` da mesa — código separado, decisão igual, porque
 * a alternativa é reimplementar acessibilidade que o `<dialog>` já dá pronta.
 */
@Component({
  selector: 'mer-sheet',
  standalone: true,
  templateUrl: './sheet.html',
  styleUrl: './sheet.css',
})
export class MerSheet {
  readonly open = input(false);

  /** `right` para formulário e leitura longa; `center` para uma pergunta só. */
  readonly side = input<'right' | 'center'>('right');

  readonly eyebrow = input<string>();
  readonly heading = input.required<string>();
  readonly description = input<string>();

  /** Fecha por Escape, pelo X, pelo fundo ou por quem abriu. */
  readonly closed = output<void>();

  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    let locked = false;

    const lock = (next: boolean) => {
      if (next === locked) return;
      locked = next;
      openSheets += next ? 1 : -1;
      document.body.style.overflow = openSheets > 0 ? 'hidden' : '';
    };

    effect(() => {
      const dialog = this.dialogRef()?.nativeElement;
      if (!dialog) return;

      if (this.open()) {
        if (!dialog.open) show(dialog);
        lock(true);
      } else {
        if (dialog.open) hide(dialog);
        lock(false);
      }
    });

    inject(DestroyRef).onDestroy(() => lock(false));
  }

  protected dismiss(): void {
    const dialog = this.dialogRef()?.nativeElement;
    if (dialog?.open) hide(dialog);
  }

  /** Só o clique no fundo fecha — a folha não tem preenchimento próprio. */
  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialogRef()?.nativeElement) this.dismiss();
  }
}

/** Várias folhas podem coexistir (saque abre a de contas por cima). */
let openSheets = 0;

/*
 * `showModal` é o que dá foco preso e camada de topo. Onde ele não existe —
 * jsdom, por exemplo — a folha ainda abre pelo atributo, só sem a inércia do
 * navegador. Vale mais uma folha simples do que uma tela que quebra no teste.
 */
function show(dialog: HTMLDialogElement): void {
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
    return;
  }
  dialog.setAttribute('open', '');
}

function hide(dialog: HTMLDialogElement): void {
  if (typeof dialog.close === 'function') {
    dialog.close();
    return;
  }
  dialog.removeAttribute('open');
  dialog.dispatchEvent(new Event('close'));
}
