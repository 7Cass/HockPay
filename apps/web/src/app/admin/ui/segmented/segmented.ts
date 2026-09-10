import { Component, ElementRef, input, output, viewChildren } from '@angular/core';

/** Uma opção do segmentado. `count` é opcional porque nem toda API sabe contar. */
export interface AdmSegmentedOption<T> {
  readonly value: T;
  readonly label: string;
  readonly count?: number | string;
  readonly hint?: string;
}

/**
 * O controle de escolha única que mostra as alternativas junto com a escolha.
 *
 *   <adm-segmented [options]="filters" [value]="filter()" (valueChange)="select($event)"
 *                  ariaLabel="Estado da habilitação" />
 *
 * Serve para os três lugares onde a mesa escolhe entre poucos caminhos: o filtro
 * da fila, o ambiente investigado (TEST/LIVE) e as abas da investigação. São o
 * mesmo gesto — trocar o recorte do que está na tela — e por isso são o mesmo
 * controle, com `mode` dizendo só qual papel de acessibilidade anunciar.
 *
 * Seta esquerda e direita andam entre as opções, porque um controle de teclado
 * que só responde a Tab obriga a passar por todas as opções para chegar na
 * última.
 */
@Component({
  selector: 'adm-segmented',
  standalone: true,
  template: `
    @for (option of options(); track option.value) {
      <button
        #opt
        type="button"
        [attr.role]="mode() === 'tab' ? 'tab' : null"
        [attr.aria-selected]="mode() === 'tab' ? value() === option.value : null"
        [attr.aria-pressed]="mode() === 'tab' ? null : value() === option.value"
        [attr.title]="option.hint ?? null"
        [class.is-active]="value() === option.value"
        (click)="valueChange.emit(option.value)"
        (keydown)="onKeydown($event, $index)"
      >
        {{ option.label }}
        @if (option.count !== undefined) {
          <span class="count">{{ option.count }}</span>
        }
      </button>
    }
  `,
  styleUrl: './segmented.css',
  host: {
    class: 'adm-segmented',
    '[attr.role]': "mode() === 'tab' ? 'tablist' : 'group'",
    '[attr.aria-label]': 'ariaLabel()',
    '[attr.data-size]': 'size()',
  },
})
export class AdmSegmented<T> {
  readonly options = input.required<readonly AdmSegmentedOption<T>[]>();

  readonly value = input.required<T>();

  readonly ariaLabel = input<string>();

  /** `tab` troca o conteúdo da tela; `group` troca um parâmetro da leitura. */
  readonly mode = input<'tab' | 'group'>('tab');

  readonly size = input<'sm' | 'md'>('md');

  readonly valueChange = output<T>();

  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('opt');

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;

    const options = this.options();
    const next = (index + step + options.length) % options.length;

    event.preventDefault();
    this.valueChange.emit(options[next]!.value);
    this.buttons()[next]?.nativeElement.focus();
  }
}
