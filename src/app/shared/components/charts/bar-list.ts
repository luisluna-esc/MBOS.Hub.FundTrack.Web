import { Component, computed, input, signal } from '@angular/core';
import { formatInteger, ValueFormat } from './chart-utils';

export interface BarListItem {
  key: string;
  label: string;
  /** Texto chico debajo del nombre (por ejemplo el distrito). */
  detail?: string;
  value: number;
  /** Texto del cuadro del mouse; si no, el valor con el formato. */
  tooltip?: string;
}

// Barras horizontales de una sola serie, de mayor a menor, con el valor al final de cada barra.
// La barra crece desde la izquierda (se usa el valor absoluto, así sirve para faltantes) y tiene
// el extremo redondeado. Al pasar el mouse se resalta la fila y se ve el detalle.
@Component({
  selector: 'app-bar-list',
  host: { class: 'block w-full' },
  template: `
    <ul class="flex flex-col" (mouseleave)="hovered.set(null)">
      @for (item of items(); track item.key) {
        <li class="relative grid grid-cols-[minmax(7rem,38%)_1fr] items-center gap-3 rounded px-1 py-1.5"
          [class.opacity-50]="hovered() !== null && hovered() !== item.key" (mouseenter)="hovered.set(item.key)">
          <div class="min-w-0">
            <p class="truncate text-xs font-medium text-chart-ink" [title]="item.label">{{ item.label }}</p>
            @if (item.detail) {
              <p class="truncate text-[11px] text-chart-ink-muted">{{ item.detail }}</p>
            }
          </div>
          <div class="flex min-w-0 items-center gap-2">
            <div class="h-3 rounded-r-[4px]" [style.width.%]="share(item)" [style.background]="color()"></div>
            <span class="shrink-0 text-xs font-medium tabular-nums text-chart-ink">{{ format()(item.value) }}</span>
          </div>
          @if (hovered() === item.key && item.tooltip) {
            <div class="pointer-events-none absolute right-0 bottom-full z-10 rounded-md border border-border bg-chart-surface px-3 py-1.5 text-xs text-chart-ink shadow-md">
              {{ item.tooltip }}
            </div>
          }
        </li>
      } @empty {
        <li class="px-1 py-6 text-center text-sm text-chart-ink-muted">{{ emptyLabel() }}</li>
      }
    </ul>
  `,
})
export class BarList {
  readonly items = input.required<BarListItem[]>();
  readonly color = input('var(--color-chart-1)');
  readonly format = input<ValueFormat>(formatInteger);
  /** Valor que llena la barra entera (por ejemplo 100 en porcentajes); si no, el mayor de la lista. */
  readonly max = input<number | null>(null);
  readonly emptyLabel = input('');

  protected readonly hovered = signal<string | null>(null);

  private readonly top = computed(() => this.max() ?? Math.max(...this.items().map((i) => Math.abs(i.value)), 0));

  /** Hasta 82% del ancho, para que el valor siempre entre al final de la barra. */
  protected share(item: BarListItem): number {
    const top = this.top();
    return top ? (Math.abs(item.value) / top) * 82 : 0;
  }
}
