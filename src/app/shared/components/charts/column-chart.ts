import { Component, computed, input, signal } from '@angular/core';
import { barPath, ChartSeries, formatCompact, formatInteger, niceTicks, observeWidth, ValueFormat } from './chart-utils';

interface Segment {
  key: string;
  path: string;
}

interface Column {
  index: number;
  x: number;
  segments: Segment[];
}

const MARGIN = { top: 12, right: 8, bottom: 26, left: 48 };
const MAX_BAR = 24;
const GAP = 2;

// Columnas (apiladas si hay varias series). Los valores positivos suben desde la base y los
// negativos bajan, así sirve también para "sobra / falta". Una sola base, columnas de 24px como
// máximo con el extremo redondeado, 2px de aire entre segmentos, y al pasar el mouse un cuadro con
// los valores de esa columna.
@Component({
  selector: 'app-column-chart',
  host: { class: 'relative block w-full' },
  template: `
    <svg [attr.width]="width()" [attr.height]="height()" role="img" [attr.aria-label]="ariaLabel()" (mouseleave)="hovered.set(null)">
      @for (tick of ticks(); track tick) {
        <line [attr.x1]="left" [attr.x2]="width() - right" [attr.y1]="y(tick)" [attr.y2]="y(tick)"
          [attr.stroke]="tick === 0 ? 'var(--color-chart-axis)' : 'var(--color-chart-grid)'" stroke-width="1" />
        <text [attr.x]="left - 8" [attr.y]="y(tick)" text-anchor="end" dominant-baseline="middle"
          font-size="11" fill="var(--color-chart-ink-muted)" class="tabular-nums">{{ axisFormat()(tick) }}</text>
      }
      @for (column of columns(); track column.index) {
        <g [attr.opacity]="hovered() === null || hovered() === column.index ? 1 : 0.45">
          @for (segment of column.segments; track segment.key) {
            <path [attr.d]="segment.path" [attr.fill]="color(segment.key)" />
          }
        </g>
        <text [attr.x]="column.x" [attr.y]="height() - 8" text-anchor="middle" font-size="11" fill="var(--color-chart-ink-muted)">
          {{ categories()[column.index] }}
        </text>
        <rect [attr.x]="column.x - band() / 2" [attr.y]="top" [attr.width]="band()" [attr.height]="plotHeight()"
          fill="transparent" (mouseenter)="hovered.set(column.index)" />
      }
    </svg>

    @let index = hovered();
    @if (index !== null) {
      <div class="pointer-events-none absolute z-10 min-w-40 rounded-md border border-border bg-chart-surface px-3 py-2 text-xs shadow-md"
        [style.left.px]="tooltipLeft(index)" [style.top.px]="top">
        <p class="mb-1 font-semibold text-chart-ink">{{ (titles() ?? categories())[index] }}</p>
        @for (s of series(); track s.key) {
          @if (s.values[index] !== null) {
            <p class="flex items-center justify-between gap-4 text-chart-ink-muted">
              <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm" [style.background]="s.color"></span>{{ s.label }}</span>
              <span class="font-medium tabular-nums text-chart-ink">{{ format()(s.values[index]!) }}</span>
            </p>
          }
        }
        @if (totalLabel(); as label) {
          <p class="mt-1 flex justify-between gap-4 border-t border-border pt-1 text-chart-ink">
            <span>{{ label }}</span><span class="font-semibold tabular-nums">{{ format()(total(index)) }}</span>
          </p>
        }
      </div>
    }
  `,
})
export class ColumnChart {
  readonly categories = input.required<string[]>();
  /** Títulos completos para el cuadro del mouse (por ejemplo "Enero 2026"); si no, la categoría. */
  readonly titles = input<string[] | null>(null);
  readonly series = input.required<ChartSeries[]>();
  readonly height = input(260);
  readonly format = input<ValueFormat>(formatInteger);
  readonly axisFormat = input<ValueFormat>(formatCompact);
  /** Si se indica, el cuadro del mouse muestra la suma de la columna con esta etiqueta. */
  readonly totalLabel = input<string | null>(null);
  readonly ariaLabel = input('');

  protected readonly width = observeWidth();
  protected readonly hovered = signal<number | null>(null);
  protected readonly left = MARGIN.left;
  protected readonly right = MARGIN.right;
  protected readonly top = MARGIN.top;

  protected readonly plotHeight = computed(() => this.height() - MARGIN.top - MARGIN.bottom);
  protected readonly band = computed(() => (this.width() - MARGIN.left - MARGIN.right) / Math.max(1, this.categories().length));

  private readonly extent = computed(() => {
    let min = 0;
    let max = 0;
    this.categories().forEach((_, i) => {
      let up = 0;
      let down = 0;
      for (const s of this.series()) {
        const value = s.values[i] ?? 0;
        if (value >= 0) up += value;
        else down += value;
      }
      max = Math.max(max, up);
      min = Math.min(min, down);
    });
    return { min, max };
  });

  protected readonly ticks = computed(() => niceTicks(this.extent().min, this.extent().max));

  protected y(value: number): number {
    const ticks = this.ticks();
    const low = ticks[0];
    const high = ticks[ticks.length - 1];
    return MARGIN.top + ((high - value) / (high - low || 1)) * this.plotHeight();
  }

  protected readonly columns = computed<Column[]>(() => {
    const band = this.band();
    const barWidth = Math.min(MAX_BAR, band * 0.6);
    return this.categories().map((_, index) => {
      const x = MARGIN.left + band * (index + 0.5);
      const segments: Segment[] = [];
      for (const sign of [1, -1]) {
        const parts = this.series()
          .map((s) => ({ key: s.key, value: s.values[index] ?? 0 }))
          .filter((p) => (sign > 0 ? p.value > 0 : p.value < 0));
        let base = 0;
        parts.forEach((part, i) => {
          const from = this.y(base);
          const to = this.y(base + part.value);
          base += part.value;
          const outer = i === parts.length - 1;
          // 2px de la superficie entre segmentos: el segmento interior se acorta del lado del siguiente.
          const shrink = outer ? 0 : GAP;
          const height = Math.abs(to - from) - shrink;
          const yTop = sign > 0 ? to + shrink : from;
          segments.push({ key: part.key, path: barPath(x - barWidth / 2, yTop, barWidth, height, outer ? 4 : 0, sign > 0) });
        });
      }
      return { index, x, segments };
    });
  });

  protected color(key: string): string {
    return this.series().find((s) => s.key === key)?.color ?? 'var(--color-chart-neutral)';
  }

  protected total(index: number): number {
    return this.series().reduce((sum, s) => sum + (s.values[index] ?? 0), 0);
  }

  /** El cuadro va a la derecha de la columna, o a la izquierda si no entra. */
  protected tooltipLeft(index: number): number {
    const x = MARGIN.left + this.band() * (index + 0.5);
    return x + 180 > this.width() ? Math.max(0, x - 192) : x + 16;
  }
}
