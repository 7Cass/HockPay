import { Component, booleanAttribute, input } from '@angular/core';

/**
 * A única caixa do console.
 *
 *   <mer-panel heading="Saldo" note="do ambiente da sessão">…</mer-panel>
 *   <mer-panel heading="Pagamentos" flush>…tabela…</mer-panel>
 *
 * Borda, sem sombra: a hierarquia vem do chão da área de trabalho ser mais
 * escuro que o papel do painel. Sombra aqui imitaria profundidade num plano que
 * não tem nenhuma, e cada sombra a mais é um pixel a menos de densidade.
 *
 * `flush` tira o preenchimento do corpo, para o painel que carrega uma tabela:
 * a tabela já traz o respiro nas células, e o acolchoado em volta só empurra a
 * última linha para fora da tela.
 */
@Component({
  selector: 'mer-panel',
  standalone: true,
  template: `
    @if (heading() || hasHead()) {
      <div class="head">
        <div class="head-text">
          @if (heading(); as text) {
            <h2>{{ text }}</h2>
          }
          @if (note(); as text) {
            <span class="note">{{ text }}</span>
          }
        </div>
        <div class="head-actions">
          <ng-content select="[panelActions]" />
        </div>
      </div>
    }

    <div class="body" [class.is-flush]="flush()">
      <ng-content />
    </div>
  `,
  styleUrl: './panel.css',
  host: { class: 'mer-panel' },
})
export class MerPanel {
  readonly heading = input<string>();

  /** A ressalva curta ao lado do título — não é subtítulo. */
  readonly note = input<string>();

  readonly flush = input(false, { transform: booleanAttribute });

  /** Desenha a faixa do topo mesmo sem título, para painel que só tem ações. */
  readonly hasHead = input(false, { transform: booleanAttribute, alias: 'head' });
}
