import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';

/**
 * Cabeçalho de uma tela do dashboard.
 *
 * As dezoito telas abrem do mesmo jeito — rótulo, título, uma linha de
 * explicação e as ações à direita — então o bloco é um só.
 *
 *   <app-page-header
 *     eyebrow="Loja · Ateliê Corvo"
 *     heading="Clientes"
 *     description="Pagadores identificados por externalId."
 *   >
 *     <span pageStatus class="chip" data-tone="ok">Ativo</span>
 *     <button pageActions class="btn btn-quiet">Atualizar</button>
 *   </app-page-header>
 *
 * Telas de detalhe passam `backTo` para ganhar o link de volta.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [RouterLink, NgIcon],
  providers: [provideIcons({ lucideArrowLeft })],
  templateUrl: './page-header.html',
  styleUrl: './page-header.css',
})
export class PageHeader {
  /** Rótulo em mono acima do título. Contexto, não repetição do título. */
  readonly eyebrow = input<string>();

  /** O título da tela. */
  readonly heading = input.required<string>();

  /** Uma linha sobre o que a tela faz. Duas, no máximo. */
  readonly description = input<string>();

  /** Rota do link de voltar. Sem isso, o link não aparece. */
  readonly backTo = input<string | readonly unknown[]>();

  readonly backLabel = input('Voltar');
}
