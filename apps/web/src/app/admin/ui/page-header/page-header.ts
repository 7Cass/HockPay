import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft } from '@ng-icons/lucide';

/**
 * O cabeçalho de uma tela do admin.
 *
 *   <adm-page-header heading="Fila de habilitação"
 *                    description="Quem pediu LIVE, quem já opera, e quem foi recusado.">
 *     <adm-status-chip pageStatus status="APPROVED" />
 *     <ng-container pageActions>
 *       <button admButton variant="ghost" iconOnly aria-label="Atualizar">…</button>
 *     </ng-container>
 *   </adm-page-header>
 *
 * O irmão do lojista (`shared/ui/page-header`) põe o título em `--font-display`,
 * uma serifa — é a voz da marca, e ela está certa numa tela que alguém escolhe
 * visitar. Aqui o título é sans, 17px, semibold: quem lê esta tela não está
 * sendo convencido de nada, está trabalhando, e uma serifa de 34px só empurra a
 * primeira linha da tabela para baixo da dobra.
 */
@Component({
  selector: 'adm-page-header',
  standalone: true,
  imports: [NgIcon, RouterLink],
  providers: [provideIcons({ lucideChevronLeft })],
  template: `
    @if (backTo(); as back) {
      <a class="back" [routerLink]="back">
        <ng-icon name="lucideChevronLeft" size="13px" strokeWidth="2" aria-hidden="true" />
        {{ backLabel() }}
      </a>
    }

    <div class="row">
      <div class="text">
        <div class="title">
          <h1>{{ heading() }}</h1>
          <ng-content select="[pageStatus]" />
        </div>

        @if (description(); as text) {
          <p class="desc">{{ text }}</p>
        }
      </div>

      <div class="actions">
        <ng-content select="[pageActions]" />
      </div>
    </div>
  `,
  styleUrl: './page-header.css',
  host: { class: 'adm-page-header' },
})
export class AdmPageHeader {
  readonly heading = input.required<string>();

  readonly description = input<string>();

  /** Para onde volta a navegação, quando a tela é um detalhe. */
  readonly backTo = input<string>();

  readonly backLabel = input('Voltar');
}
