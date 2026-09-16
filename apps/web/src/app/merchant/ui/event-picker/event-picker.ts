import { Component, computed, input, output } from '@angular/core';

import { EVENT_GROUPS, SUBSCRIBABLE_EVENTS } from '../../domain/webhook-events';

/**
 * Escolher o que se quer receber.
 *
 *   <mer-event-picker [selected]="events()" (changed)="events.set($event)" />
 *
 * Mora no kit, e não em cada tela, porque webhooks e alertas assinam
 * exatamente a mesma lista — em `packages/core`, `ALLOWED_ALERT_EVENTS` é uma
 * cópia de `ALLOWED_WEBHOOK_EVENTS`. Duas marcações iguais eram duas chances de
 * uma delas envelhecer.
 *
 * Cada evento leva a sua frase. A lista sem explicação obriga a adivinhar a
 * diferença entre `payment.confirmed` e `payment.released` — que é justamente a
 * diferença entre "entrou dinheiro" e "posso sacar".
 */
@Component({
  selector: 'mer-event-picker',
  standalone: true,
  template: `
    <div class="pick-head">
      <span class="pick-count">
        {{ selected().length }} de {{ total }} evento{{ total === 1 ? '' : 's' }}
      </span>

      <span class="pick-actions">
        <button type="button" class="pick-link" [disabled]="allOn()" (click)="selectAll()">
          Todos
        </button>
        <button
          type="button"
          class="pick-link"
          [disabled]="selected().length === 0"
          (click)="clear()"
        >
          Nenhum
        </button>
      </span>
    </div>

    @for (group of groups; track group.label) {
      <fieldset class="pick-group">
        <legend>{{ group.label }}</legend>

        @for (option of group.options; track option.value) {
          <label class="pick-row">
            <input
              type="checkbox"
              [checked]="has(option.value)"
              [disabled]="disabled()"
              (change)="toggle(option.value)"
            />
            <span class="pick-text">
              <span class="pick-label">{{ option.label }}</span>
              <span class="pick-hint">{{ option.hint }}</span>
              <span class="pick-type mer-mono">{{ option.value }}</span>
            </span>
          </label>
        }
      </fieldset>
    }
  `,
  styleUrl: './event-picker.css',
  host: { class: 'mer-event-picker' },
})
export class MerEventPicker {
  readonly selected = input.required<readonly string[]>();
  readonly disabled = input(false);

  readonly changed = output<readonly string[]>();

  protected readonly groups = EVENT_GROUPS;
  protected readonly total = SUBSCRIBABLE_EVENTS.length;

  protected readonly allOn = computed(() => this.selected().length === this.total);

  protected has(value: string): boolean {
    return this.selected().includes(value);
  }

  protected toggle(value: string): void {
    const current = this.selected();
    this.changed.emit(
      current.includes(value)
        ? current.filter((event) => event !== value)
        : /* A ordem do catálogo, e não a ordem dos cliques: a mesma assinatura
             feita em duas sessões vira a mesma lista. */
          SUBSCRIBABLE_EVENTS.filter((event) => event === value || current.includes(event)),
    );
  }

  protected selectAll(): void {
    this.changed.emit(SUBSCRIBABLE_EVENTS);
  }

  protected clear(): void {
    this.changed.emit([]);
  }
}
