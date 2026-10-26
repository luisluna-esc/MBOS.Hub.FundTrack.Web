import { ChartSeries } from './chart-utils';

export type ChartReportFormat = 'pdf' | 'excel' | 'txt';
export type ChartValueFormat = 'integer' | 'money' | 'percent';
export type ChartColumnFormat = 'text' | ChartValueFormat;

/** ChartReportRequestDto de POST /api/reports/chart/{format}: lo que la gráfica dibuja, más su tabla. */
export interface ChartReport {
  title: string;
  subtitle: string;
  /** Los filtros elegidos, una línea cada uno. */
  filters: string[];
  chartType: 'line' | 'column' | 'bars' | 'none';
  valueFormat: ChartValueFormat;
  categories: string[];
  series: { label: string; color: string; values: (number | null)[] }[];
  headers: string[];
  columnFormats: ChartColumnFormat[];
  /** Los números van sin formato (String(1234.5)); el backend los formatea. */
  rows: (string | null)[][];
  fileName: string;
}

/** var(--color-chart-1) -> chart-1, el token que entiende el backend. */
export function reportSeries(series: ChartSeries[]): ChartReport['series'] {
  return series.map((s) => ({
    label: s.label,
    color: /--color-(chart-[a-z0-9]+)/.exec(s.color)?.[1] ?? 'chart-1',
    values: s.values,
  }));
}

/** Un número como texto sin formato, o vacío si no hay dato. */
export function cell(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : String(value);
}
