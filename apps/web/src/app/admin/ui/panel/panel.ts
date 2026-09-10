import { Component, booleanAttribute, input } from '@angular/core';

/**
 * A única caixa do admin.
 *
 *   <adm-panel heading="Condição comercial" note="vale daqui para frente">
 *     <ng-container panelActions><button admButton size="sm">Recarregar</button></ng-container>
 *     <p>…</p>
 *   </adm-panel>
 *
 *   <adm-panel heading="Fila" flush>…tabela…</adm-panel>
 *
 * Borda, sem sombra: a hierarquia vem do chão da área de trabalho ser mais
 * escuro que o papel do painel. Sombra aqui só imitaria profundidade num plano
 * que não tem nenhuma — e cada sombra a mais é um pixel a menos de densidade.
 *
 * `flush` tira o preenchimento do corpo, para o painel que carrega uma tabela:
 * a tabela já traz o próprio respiro nas células, e o painel acolchoado em volta
 * dela só empurra a última linha para fora da tela.
 */
@Component({
  selector: 'adm-panel',
  standalone: true,
  template: `
    @if (heading() || hasHead()) {
      <div class="head">
        <div class="head-text">
          <h2>{{ heading() }}</h2>
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
  host: { class: 'adm-panel' },
})
export class AdmPanel {
  readonly heading = input<string>();

  /** A ressalva curta que mora ao lado do título — não é subtítulo. */
  readonly note = input<string>();

  readonly flush = input(false, { transform: booleanAttribute });

  /**
   * Desenha a faixa do cabeçalho mesmo sem título, para o painel que só tem
   * controles no topo.
   */
  readonly hasHead = input(false, { transform: booleanAttribute, alias: 'head' });
}
