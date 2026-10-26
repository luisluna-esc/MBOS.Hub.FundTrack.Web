import { Component, computed, input, signal } from '@angular/core';
import { ChartSeries, formatCompact, formatMoney, niceTicks, observeWidth, ValueFormat } from './chart-utils';

const MARGIN = { top: 12, right: 12, bottom: 26, left: 52 };

// Líneas de 2px sobre una sola escala (nunca dos ejes). Un valor null corta la línea, así un mes
// sin datos no se dibuja como si fuera cero. Al pasar el mouse: línea vertical en ese mes, puntos
// con anillo de la superficie y un cuadro con los valores.
@Component({
  selector: 'app-line-chart',
  host: { class: 'relative block w-full' },
  template: `
    <svg [attr.width]="width()" [attr.height]="height()" role="img" [attr.aria-label]="ariaLabel()" (mouseleave)="hovered.set(null)">
      @for (tick of ticks(); track tick) {
        <line [attr.x1]="left" [attr.x2]="width() - right" [attr.y1]="y(tick)" [attr.y2]="y(tick)"
          [attr.stroke]="tick === 0 ? 'var(--color-chart-axis)' : 'var(--color-chart-grid)'" stroke-width="1" />
        <text [attr.x]="left - 8" [attr.y]="y(tick)" text-anchor="end" dominant-baseline="middle"
          font-size="11" fill="var(--color-chart-ink-muted)" class="tabular-nums">{{ axisFormat()(tick) }}</text>
      }
      @for (label of categories(); track $index) {
        <text [attr.x]="x($index)" [attr.y]="height() - 8" text-anchor="middle" font-size="11" fill="var(--color-chart-ink-muted)">{{ label }}</text>
      }

      @let index = hovered();
      @if (index !== null) {
        <line [attr.x1]="x(index)" [attr.x2]="x(index)" [attr.y1]="top" [attr.y2]="top + plotHeight()" stroke="var(--color-chart-axis)" stroke-width="1" />
      }

      @for (s of series(); track s.key) {
        <path [attr.d]="linePath(s)" fill="none" [attr.stroke]="s.color" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        @for (point of points(s); track point.index) {
          @if (markers() || point.index === index || point.alone) {
            <circle [attr.cx]="point.x" [attr.cy]="point.y" r="4" [attr.fill]="s.color" stroke="var(--color-chart-surface)" stroke-width="2" />
          }
        }
      }

      @for (label of categories(); track $index) {
        <rect [attr.x]="x($index) - step() / 2" [attr.y]="top" [attr.width]="step()" [attr.height]="plotHeight()"
          fill="transparent" (mouseenter)="hovered.set($index)" />
      }
    </svg>

    @if (index !== null) {
      <div class="pointer-events-none absolute z-10 min-w-44 rounded-md border border-border bg-chart-surface px-3 py-2 text-xs shadow-md"
        [style.left.px]="tooltipLeft(index)" [style.top.px]="top">
        <p class="mb-1 font-semibold text-chart-ink">{{ (titles() ?? categories())[index] }}</p>
        @for (s of series(); track s.key) {
          <p class="flex items-center justify-between gap-4 text-chart-ink-muted">
            <span class="flex items-center gap-1.5"><span class="h-0.5 w-3 rounded-full" [style.background]="s.color"></span>{{ s.label }}</span>
            <span class="font-medium tabular-nums text-chart-ink">{{ s.values[index] === null ? emptyLabel() : format()(s.values[index]!) }}</span>
          </p>
        }
      </div>
    }
  `,
})
export class LineChart {
  readonly categories = input.required<string[]>();
  readonly titles = input<string[] | null>(null);
  readonly series = input.required<ChartSeries[]>();
  readonly height = input(260);
  readonly format = input<ValueFormat>(formatMoney);
  readonly axisFormat = input<ValueFormat>(formatCompact);
  /** Punto en cada mes con dato (para pocas series y pocos meses, como una sola iglesia). */
  readonly markers = input(false);
  /** Texto del cuadro para un mes sin dato. */
  readonly emptyLabel = input('');
  readonly ariaLabel = input('');

  protected readonly width = observeWidth();
  protected readonly hovered = signal<number | null>(null);
  protected readonly left = MARGIN.left;
  protected readonly right = MARGIN.right;
  protected readonly top = MARGIN.top;

  protected readonly plotHeight = computed(() => this.height() - MARGIN.top - MARGIN.bottom);
  protected readonly step = computed(() => (this.width() - MARGIN.left - MARGIN.right) / Math.max(1, this.categories().length));

  protected readonly ticks = computed(() => {
    const values = this.series().flatMap((s) => s.values.filter((v): v is number => v !== null));
    return niceTicks(Math.min(0, ...values), Math.max(0, ...values));
  });

  protected x(index: number): number {
    return MARGIN.left + this.step() * (index + 0.5);
  }

  protected y(value: number): number {
    const ticks = this.ticks();
    const low = ticks[0];
    const high = ticks[ticks.length - 1];
    return MARGIN.top + ((high - value) / (high - low || 1)) * this.plotHeight();
  }

  /** Puntos con dato; "alone" marca los que no tienen vecino, que sin punto no se verían. */
  protected points(series: ChartSeries) {
    return series.values
      .map((value, index) => ({ value, index }))
      .filter((p): p is { value: number; index: number } => p.value !== null)
      .map((p) => ({
        index: p.index,
        x: this.x(p.index),
        y: this.y(p.value),
        alone: series.values[p.index - 1] == null && series.values[p.index + 1] == null,
      }));
  }

  protected linePath(series: ChartSeries): string {
    let path = '';
    let drawing = false;
    series.values.forEach((value, index) => {
      if (value === null) {
        drawing = false;
        return;
      }
      path += `${drawing ? 'L' : 'M'}${this.x(index)},${this.y(value)}`;
      drawing = true;
    });
    return path;
  }

  protected tooltipLeft(index: number): number {
    const x = this.x(index);
    return x + 196 > this.width() ? Math.max(0, x - 208) : x + 16;
  }
}
