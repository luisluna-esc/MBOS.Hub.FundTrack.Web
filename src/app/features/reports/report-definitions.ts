// Los 8 reportes de FundTrack. Cada uno dice qué filtros usa y a qué endpoint de /api/reports va;
// la pantalla (report-page) es la misma para todos. Los datos salen siempre de un procedimiento
// almacenado sp_report_* del backend, que también limita al Pastor a su distrito.

export type ReportFilter =
  | 'year'
  | 'monthRange'
  | 'period'
  | 'region'
  | 'district'
  | 'differenceStatus'
  | 'changeType'
  | 'dateRange'
  | 'church'
  | 'groupBy';

export interface ReportDefinition {
  /** Parte final de la ruta (/reports/:key) y clave de i18n (reports.<key>.*). */
  key: string;
  /** Ruta del backend: /api/reports/<endpoint>/pdf y /excel. */
  endpoint: string;
  /** Nombre del archivo descargado, sin extensión. */
  fileName: string;
  filters: ReportFilter[];
  /** Solo PDF (la hoja del arqueo no tiene versión Excel). */
  pdfOnly?: boolean;
  /** Pide un distrito o una iglesia antes de generar (un mes de toda la Misión serían cientos de hojas). */
  needsDistrictOrChurch?: boolean;
}

export const REPORTS: ReportDefinition[] = [
  {
    key: 'local-fund-count',
    endpoint: 'local-fund-count',
    fileName: 'arqueo-fondo-local',
    filters: ['period', 'region', 'district', 'church'],
    pdfOnly: true,
    needsDistrictOrChurch: true,
  },
  { key: 'local-fund', endpoint: 'local-fund', fileName: 'fondo-local', filters: ['year', 'monthRange', 'region', 'district'] },
  { key: 'pending', endpoint: 'pending', fileName: 'pendientes', filters: ['period', 'region', 'district'] },
  { key: 'differences', endpoint: 'differences', fileName: 'diferencias', filters: ['year', 'differenceStatus', 'region', 'district'] },
  { key: 'compliance', endpoint: 'compliance', fileName: 'cumplimiento', filters: ['year', 'region', 'district'] },
  { key: 'negative-acms', endpoint: 'negative-acms', fileName: 'acms-negativo', filters: ['year', 'monthRange', 'region', 'district'] },
  // Agrupar por región o por distrito; la región solo filtra cuando se agrupa por distrito.
  { key: 'region-summary', endpoint: 'region-summary', fileName: 'resumen-regiones', filters: ['year', 'monthRange', 'groupBy', 'region'] },
  { key: 'corrections', endpoint: 'corrections', fileName: 'correcciones', filters: ['year', 'region', 'district'] },
  { key: 'church-movements', endpoint: 'church-movements', fileName: 'movimientos-iglesias', filters: ['dateRange', 'changeType', 'region', 'district'] },
];

export function findReport(key: string | null | undefined): ReportDefinition | null {
  return REPORTS.find((report) => report.key === key) ?? null;
}
