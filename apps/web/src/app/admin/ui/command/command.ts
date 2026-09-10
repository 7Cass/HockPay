import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCornerDownLeft, lucideSearch } from '@ng-icons/lucide';

import { AdmKbd } from '../kbd/kbd';

/** Uma coisa que a mesa sabe fazer sem sair de onde está. */
export interface AdmCommand {
  readonly id: string;
  readonly label: string;
  /** O que aparece à direita: o estado atual, um atalho, um identificador. */
  readonly hint?: string;
  /** O cabeçalho sob o qual o comando aparece. */
  readonly group: string;
  readonly icon?: string;
  /** Sinônimos que o operador pode digitar e que não estão no rótulo. */
  readonly keywords?: string;
  readonly run: () => void;
}

/**
 * A paleta de comandos — ⌘K.
 *
 *   <adm-command-palette [open]="isOpen()" [commands]="commands()"
 *                        (queryChange)="query.set($event)" (closed)="close()" />
 *
 * Num console de operação a paleta não é enfeite: é o caminho mais curto entre
 * "recebi um chamado com o id da loja" e "estou olhando a loja". O teclado é o
 * dispositivo de quem trabalha aqui, e a paleta é onde ele chega a qualquer
 * destino sem procurar o menu que leva até ele.
 *
 * A lista é dada de fora, inclusive a parte que depende do que foi digitado — é
 * por isso que existe `queryChange`. Assim o shell pode oferecer "abrir loja
 * <id>" enquanto o operador cola um identificador, sem que a paleta precise
 * conhecer loja, rota ou serviço nenhum.
 */
@Component({
  selector: 'adm-command-palette',
  standalone: true,
  imports: [AdmKbd, NgIcon],
  providers: [provideIcons({ lucideCornerDownLeft, lucideSearch })],
  templateUrl: './command.html',
  styleUrl: './command.css',
})
export class AdmCommandPalette {
  readonly open = input(false);

  readonly commands = input.required<readonly AdmCommand[]>();

  readonly placeholder = input('Buscar destino, ação ou id de loja…');

  readonly closed = output<void>();
  readonly queryChange = output<string>();

  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dlg');
  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('field');

  protected readonly query = signal('');
  protected readonly active = signal(0);

  protected readonly matches = computed(() => {
    const query = normalize(this.query());
    if (!query) return this.commands();

    return this.commands().filter((command) =>
      normalize(`${command.label} ${command.group} ${command.keywords ?? ''}`).includes(query),
    );
  });

  /** A lista já agrupada, na ordem em que os grupos aparecem. */
  protected readonly groups = computed(() => {
    const groups = new Map<string, AdmCommand[]>();

    for (const command of this.matches()) {
      const bucket = groups.get(command.group);
      if (bucket) bucket.push(command);
      else groups.set(command.group, [command]);
    }

    return [...groups].map(([name, commands]) => ({ name, commands }));
  });

  /** A posição de cada comando na lista achatada — é o que a seta percorre. */
  protected readonly flat = computed(() => this.matches());

  constructor() {
    effect(() => {
      const dialog = this.dialogRef()?.nativeElement;
      if (!dialog) return;

      if (this.open()) {
        if (!dialog.open) {
          if (typeof dialog.showModal === 'function') dialog.showModal();
          else dialog.setAttribute('open', '');
        }
        this.query.set('');
        this.active.set(0);
        queueMicrotask(() => this.inputRef()?.nativeElement.focus());
      } else if (dialog.open) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
      }
    });
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.active.set(0);
    this.queryChange.emit(value);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const total = this.flat().length;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (total === 0) return;
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.active.update((index) => (index + step + total) % total);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      this.pick(this.flat()[this.active()]);
    }
  }

  protected indexOf(command: AdmCommand): number {
    return this.flat().indexOf(command);
  }

  protected pick(command: AdmCommand | undefined): void {
    if (!command) return;
    /* Fechar antes de executar: quase todo comando navega, e uma paleta que
       fecha depois da rota trocar pisca por cima da tela nova. */
    this.closed.emit();
    command.run();
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialogRef()?.nativeElement) this.closed.emit();
  }
}

/** Sem acento e sem caixa: "sao" acha "São", que é como se digita com pressa. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
