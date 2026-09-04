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
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';

/**
 * Painel modal — lateral para formulários, centrado para confirmações.
 *
 *   <app-sheet
 *     [open]="sheetOpen()"
 *     (closed)="sheetOpen.set(false)"
 *     eyebrow="Novo link"
 *     heading="Criar link de pagamento"
 *     description="Uma cobrança Pix avulsa para enviar por qualquer canal."
 *   >
 *     <form class="form-stack">…</form>
 *     <ng-container sheetActions>
 *       <button class="btn btn-quiet">Cancelar</button>
 *       <button class="btn btn-ink">Criar</button>
 *     </ng-container>
 *   </app-sheet>
 *
 * Por baixo é um `<dialog>` nativo: foco preso, Escape, camada de topo e
 * inércia do resto da página vêm do navegador, não de uma biblioteca.
 */
@Component({
  selector: 'app-sheet',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideX })],
  templateUrl: './sheet.html',
  styleUrl: './sheet.css',
})
export class Sheet {
  readonly open = input(false);

  /** `right` para formulários longos, `center` para uma pergunta só. */
  readonly side = input<'right' | 'center'>('right');

  /** `wide` dá mais papel a um painel que carrega lista, não formulário. */
  readonly size = input<'default' | 'wide'>('default');

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

  /** Só o clique no fundo fecha — o painel não tem preenchimento próprio. */
  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialogRef()?.nativeElement) this.dismiss();
  }
}

/** Vários painéis podem coexistir (saque abre contas Pix por cima). */
let openSheets = 0;

/*
 * `showModal` é o que dá foco preso e camada de topo. Onde ele não existe —
 * jsdom, por exemplo — o painel ainda abre pelo atributo, só sem a inércia
 * do navegador. Vale mais um painel simples do que uma tela que quebra.
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
