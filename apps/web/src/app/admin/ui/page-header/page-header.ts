import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft } from '@ng-icons/lucide';

/**
 * O cabeçalho de uma tela do admin.
 *
 *   <adm-page-header heading="Fila de habilitação"
 *                    description="Quem pediu LIVE, quem já opera, e quem foi recusado.">
 *     <span pageStatus><adm-status-chip … /></span>
 *     <ng-container pageActions>
 *       <button class="adm-btn adm-btn-quiet adm-btn-icon">…</button>
 *     </ng-container>
 *   </adm-page-header>
 *
 * O irmão do lojista (`shared/ui/page-header`) põe o título em
 * `--font-display`, uma serifa — é a voz da marca, e ela está certa numa tela
 * que alguém escolhe visitar. Aqui o título é sans, 17px, semibold: quem lê
 * esta tela não está sendo convencido de nada, está trabalhando, e uma serifa
 * de 34px só empurra a primeira linha da tabela para baixo da dobra.
 */
@Component({
  selector: 'adm-page-header',
  standalone: true,
  imports: [NgIcon, RouterLink],
  providers: [provideIcons({ lucideChevronLeft })],
  templateUrl: './page-header.html',
  styleUrl: './page-header.css',
})
export class AdmPageHeader {
  readonly heading = input.required<string>();

  readonly description = input<string>();

  /** Para onde volta a trilha de navegação, quando a tela é um detalhe. */
  readonly backTo = input<string>();

  readonly backLabel = input('Voltar');
}
