import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';

/** Um acontecimento na vida de alguma coisa. */
export interface AdmTimelineEvent {
  readonly id?: string;
  readonly title: string;
  readonly at: string | Date;
  readonly description?: string | null;
  readonly meta?: string | null;
}

/**
 * A vida de um pagamento, de cima para baixo, num trilho de 1px.
 *
 *   <adm-timeline [events]="timeline().timeline" />
 *
 * O mais recente vem primeiro e ganha o ponto cheio, porque a pergunta que abre
 * uma linha do tempo é quase sempre "o que aconteceu por último". A ordem é de
 * quem passa os eventos: o componente desenha, não reordena — inverter aqui
 * esconderia um bug de ordenação da API atrás de uma tela bonita.
 */
@Component({
  selector: 'adm-timeline',
  standalone: true,
  imports: [DatePipe],
  template: `
    <ol>
      @for (event of events(); track event.id ?? $index) {
        <li>
          <div class="head">
            <span class="label">{{ event.title }}</span>
            <span class="when adm-mono">{{ event.at | date: format() }}</span>
          </div>
          @if (event.description) {
            <p class="note">{{ event.description }}</p>
          }
          @if (event.meta) {
            <span class="meta adm-mono">{{ event.meta }}</span>
          }
        </li>
      }
    </ol>
  `,
  styleUrl: './timeline.css',
})
export class AdmTimeline {
  readonly events = input.required<readonly AdmTimelineEvent[]>();

  /** Segundos incluídos por padrão: numa disputa de pagamento, eles decidem. */
  readonly format = input('dd/MM/yy HH:mm:ss');
}
