import { DestroyRef, ElementRef, inject, signal } from '@angular/core';

/** Una serie de una gráfica: su nombre, su color (variable CSS del tema) y un valor por categoría. */
export interface ChartSeries {
  key: string;
  label: string;
  /** Siempre un token del tema (var(--color-chart-1)...), nunca un color fijo. */
  color: string;
  /** null = sin dato en esa categoría (la línea se corta, la columna no se dibuja). */
  values: (number | null)[];
}

export type ValueFormat = (value: number) => string;

const COMPACT = new Intl.NumberFormat('es-BO', { notation: 'compact', maximumFractionDigits: 1 });
const INTEGER = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 });
const MONEY = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatCompact: ValueFormat = (value) => (Math.abs(value) < 1000 ? INTEGER.format(value) : COMPACT.format(value));
export const formatInteger: ValueFormat = (value) => INTEGER.format(value);
export const formatMoney: ValueFormat = (value) => `Bs ${MONEY.format(value)}`;

/** Marcas de eje "redondas" (0, 50, 100...) que cubren el rango, incluido el cero. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  const low = Math.min(0, min);
  const high = Math.max(0, max);
  if (low === high) return [0, 1];
  const raw = (high - low) / count;
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let tick = Math.floor(low / step) * step; tick <= high + step * 0.001; tick += step) {
    ticks.push(Math.round(tick * 1e6) / 1e6);
  }
  if (ticks[ticks.length - 1] < high) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/** Rectángulo con las esquinas redondeadas solo en el extremo del dato (arriba si sube, abajo si baja). */
export function barPath(x: number, y: number, width: number, height: number, radius: number, roundTop: boolean): string {
  if (height <= 0 || width <= 0) return '';
  const r = Math.min(radius, height, width / 2);
  if (roundTop) {
    return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
  }
  return `M${x},${y}V${y + height - r}Q${x},${y + height} ${x + r},${y + height}H${x + width - r}Q${x + width},${y + height} ${x + width},${y + height - r}V${y}Z`;
}

/** Ancho real del contenedor en píxeles, para que el texto de la gráfica no se estire ni se achique. */
export function observeWidth(initial = 600) {
  const width = signal(initial);
  const host = inject(ElementRef<HTMLElement>);
  const observer = new ResizeObserver(([entry]) => width.set(Math.max(240, Math.floor(entry.contentRect.width))));
  observer.observe(host.nativeElement);
  inject(DestroyRef).onDestroy(() => observer.disconnect());
  return width;
}
