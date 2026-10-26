import { Component, input, signal } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';

export interface LegendItem {
  label: string;
  color: string;
  /** 'line' para series de una gráfica de líneas. */
  shape?: 'box' | 'line';
}

// Tarjeta de una gráfica: título, descripción, leyenda (siempre que haya 2 series o más) y el botón
// Ver tabla / Ver gráfica. La tabla es la misma información en números, para quien no distingue los
// colores o necesita el valor exacto. La gráfica va en el contenido y la tabla en [table].
@Component({
  selector: 'app-chart-card',
  imports: [TranslatePipe],
  host: { class: 'block min-w-0' },
  template: `
    <section class="flex h-full flex-col gap-3 rounded-lg border border-border bg-chart-surface p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="flex min-w-0 flex-col gap-0.5">
          <h2 class="text-sm font-semibold text-chart-ink">{{ title() }}</h2>
          @if (subtitle()) {
            <p class="text-xs text-chart-ink-muted">{{ subtitle() }}</p>
          }
        </div>
        <button
          type="button"
          class="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-chart-ink transition-colors hover:bg-background"
          (click)="showTable.set(!showTable())"
        >
          {{ (showTable() ? 'charts.showChart' : 'charts.showTable') | translate }}
        </button>
      </div>

      @if (legend().length > 1 && !showTable()) {
        <ul class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-chart-ink-muted">
          @for (item of legend(); track item.label) {
            <li class="flex items-center gap-1.5">
              @if (item.shape === 'line') {
                <span class="h-0.5 w-3.5 rounded-full" [style.background]="item.color"></span>
              } @else {
                <span class="size-2.5 rounded-sm" [style.background]="item.color"></span>
              }
              {{ item.label }}
            </li>
          }
        </ul>
      }

      <div class="min-w-0 flex-1">
        @if (showTable()) {
          <div class="overflow-x-auto"><ng-content select="[table]" /></div>
        } @else {
          <ng-content />
        }
      </div>
    </section>
  `,
})
export class ChartCard {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly legend = input<LegendItem[]>([]);

  protected readonly showTable = signal(false);
}
