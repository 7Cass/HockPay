import { Component, computed, input, signal } from '@angular/core';

export interface AreaPoint {
  /** O rótulo do eixo — uma data em `yyyy-mm-dd`, na visão geral. */
  readonly label: string;
  /** O valor que desenha a linha. */
  readonly value: number;
  /** O número que acompanha no balão (vendas aprovadas, por exemplo). */
  readonly extra?: number;
}

/**
 * Uma série, desenhada à mão em SVG.
 *
 *   <mer-area-chart [points]="serie()" [format]="money" extraLabel="vendas" />
 *
 * Existe para tirar `apexcharts` do produto. A conta era ruim: **900 kB** de
 * biblioteca — mais do que todo o resto do bundle inicial — para desenhar uma
 * área de uma série só, sem zoom, sem legenda e sem barra de ferramentas. O que
 * sobra aqui são duas trajetórias, uma linha de base e um balão.
 *
 * O desenho é um `viewBox` de coordenadas próprias com `width: 100%`. Esticar
 * um SVG assim engorda o traço na horizontal; `vector-effect="non-scaling-stroke"`
 * é o que mantém a linha com a mesma espessura em qualquer largura — sem ele,
 * o gráfico fica com traço grosso no desktop e fino no celular.
 *
 * O balão é HTML, e não `<text>` dentro do SVG: texto em SVG não quebra linha,
 * não herda a tipografia do console e não se estiliza com os tokens.
 */
@Component({
  selector: 'mer-area-chart',
  standalone: true,
  template: `
    @if (points().length === 0) {
      <p class="spark-empty">Sem dados no período.</p>
    } @else {
      <figure class="spark">
        <svg
          class="spark-svg"
          [attr.viewBox]="'0 0 ' + W + ' ' + H"
          preserveAspectRatio="none"
          role="img"
          [attr.aria-label]="resumo()"
          (pointerleave)="active.set(-1)"
        >
          <!-- A base: onde é zero. Sem ela, uma série que cai não tem contra o
               que cair. -->
          <line class="spark-base" [attr.x1]="0" [attr.y1]="H" [attr.x2]="W" [attr.y2]="H" />

          <path class="spark-fill" [attr.d]="areaPath()" />
          <path class="spark-line" [attr.d]="linePath()" vector-effect="non-scaling-stroke" />

          @if (activePoint(); as point) {
            <line
              class="spark-rule"
              [attr.x1]="point.x"
              [attr.y1]="0"
              [attr.x2]="point.x"
              [attr.y2]="H"
              vector-effect="non-scaling-stroke"
            />
            <circle class="spark-dot" [attr.cx]="point.x" [attr.cy]="point.y" r="3" />
          }

          <!-- Uma faixa invisível por ponto: é ela que captura o ponteiro, e
               não a linha, que é fina demais para se acertar. -->
          @for (slot of slots(); track slot.index) {
            <rect
              class="spark-hit"
              [attr.x]="slot.x"
              [attr.y]="0"
              [attr.width]="slot.width"
              [attr.height]="H"
              (pointerenter)="active.set(slot.index)"
            />
          }
        </svg>

        @if (activePoint(); as point) {
          <div class="spark-tip" [style.left.%]="point.percent">
            <span class="spark-tip-when">{{ point.label }}</span>
            <span class="spark-tip-value">{{ format()(point.value) }}</span>
            @if (point.extra !== undefined && extraLabel()) {
              <span class="spark-tip-extra">{{ point.extra }} {{ extraLabel() }}</span>
            }
          </div>
        }

        <figcaption class="spark-axis">
          <span>{{ first() }}</span>
          <span>{{ last() }}</span>
        </figcaption>
      </figure>
    }
  `,
  styleUrl: './area-chart.css',
  host: { class: 'mer-area-chart' },
})
export class MerAreaChart {
  readonly points = input.required<readonly AreaPoint[]>();

  /** Como escrever o valor no balão — dinheiro, na visão geral. */
  readonly format = input<(value: number) => string>((value) => String(value));

  /** O substantivo do número de apoio: "vendas". Vazio esconde a linha. */
  readonly extraLabel = input('');

  /** Como escrever a data do eixo e do balão. */
  readonly formatLabel = input<(label: string) => string>((label) => label);

  protected readonly W = 600;
  protected readonly H = 180;

  protected readonly active = signal(-1);

  /**
   * O teto da escala.
   *
   * Sempre a partir de zero, e nunca a partir do menor valor: uma série entre
   * 9.800 e 10.000 desenhada de 9.800 vira um penhasco, e quem olha conclui
   * que o faturamento despencou quando ele variou dois por cento.
   */
  private readonly top = computed(() => {
    const max = Math.max(...this.points().map((point) => point.value), 0);
    return max > 0 ? max : 1;
  });

  private readonly coords = computed(() => {
    const points = this.points();
    const top = this.top();
    const step = points.length > 1 ? this.W / (points.length - 1) : 0;

    return points.map((point, index) => ({
      ...point,
      index,
      x: points.length > 1 ? index * step : this.W / 2,
      y: this.H - (point.value / top) * this.H,
    }));
  });

  protected readonly linePath = computed(() =>
    this.coords()
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)},${round(point.y)}`)
      .join(' '),
  );

  protected readonly areaPath = computed(() => {
    const line = this.linePath();
    if (!line) return '';
    const points = this.coords();
    const firstX = round(points[0].x);
    const lastX = round(points[points.length - 1].x);
    return `${line} L${lastX},${this.H} L${firstX},${this.H} Z`;
  });

  /** As faixas de captura do ponteiro, uma por ponto. */
  protected readonly slots = computed(() => {
    const points = this.coords();
    const width = points.length > 0 ? this.W / points.length : this.W;
    return points.map((point) => ({
      index: point.index,
      x: point.index * width,
      width,
    }));
  });

  protected readonly activePoint = computed(() => {
    const point = this.coords()[this.active()];
    if (!point) return null;

    return {
      ...point,
      label: this.formatLabel()(point.label),
      percent: (point.x / this.W) * 100,
    };
  });

  protected readonly first = computed(() => this.edge(0));
  protected readonly last = computed(() => this.edge(-1));

  /** O que um leitor de tela ouve no lugar do desenho. */
  protected readonly resumo = computed(() => {
    const points = this.points();
    if (points.length === 0) return 'Sem dados no período.';

    const total = points.reduce((sum, point) => sum + point.value, 0);
    return `Série de ${points.length} dias, de ${this.first()} a ${this.last()}, somando ${this.format()(total)}.`;
  });

  private edge(index: number): string {
    const points = this.points();
    const point = index < 0 ? points[points.length + index] : points[index];
    return point ? this.formatLabel()(point.label) : '';
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
