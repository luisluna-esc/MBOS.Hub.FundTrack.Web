// Los reportes de FundTrack. Cada uno dice qué filtros usa y a qué endpoint de /api/reports va;
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
  | 'periodRange'
  | 'church'
  | 'groupBy';

export interface ReportDefinition {
  /** Parte final de la ruta (/reports/:key) y clave de i18n (reports.<key>.*). */
  key: string;
  /** Ruta del backend: /api/reports/<endpoint>/pdf, /excel y /txt. */
  endpoint: string;
  /** Nombre del archivo descargado, sin extensión. */
  fileName: string;
  filters: ReportFilter[];
  /** Pide un distrito o una iglesia antes de generar (un mes de toda la Misión serían cientos de hojas). */
  needsDistrictOrChurch?: boolean;
  /** Reporte individual: no se genera hasta elegir la iglesia. */
  needsChurch?: boolean;
}

export const REPORTS: ReportDefinition[] = [
  {
    key: 'local-fund-count',
    endpoint: 'local-fund-count',
    fileName: 'arqueo-fondo-local',
    filters: ['period', 'region', 'district', 'church'],
    needsDistrictOrChurch: true,
  },
  { key: 'local-fund', endpoint: 'local-fund', fileName: 'fondo-local', filters: ['year', 'monthRange', 'region', 'district', 'church'] },
  { key: 'pending', endpoint: 'pending', fileName: 'pendientes', filters: ['period', 'region', 'district', 'church'] },
  { key: 'differences', endpoint: 'differences', fileName: 'diferencias', filters: ['year', 'differenceStatus', 'region', 'district', 'church'] },
  { key: 'compliance', endpoint: 'compliance', fileName: 'cumplimiento', filters: ['year', 'region', 'district'] },
  { key: 'negative-acms', endpoint: 'negative-acms', fileName: 'acms-negativo', filters: ['year', 'monthRange', 'region', 'district', 'church'] },
  // Agrupar por región o por distrito; la región solo filtra cuando se agrupa por distrito.
  { key: 'region-summary', endpoint: 'region-summary', fileName: 'resumen-regiones', filters: ['year', 'monthRange', 'groupBy', 'region'] },
  { key: 'corrections', endpoint: 'corrections', fileName: 'correcciones', filters: ['year', 'region', 'district', 'church'] },
  // Individual de una iglesia, con el rango de meses que se elija (por defecto los últimos 12).
  {
    key: 'church-statement',
    endpoint: 'church-statement',
    fileName: 'reporte-iglesia',
    filters: ['periodRange', 'region', 'district', 'church'],
    needsChurch: true,
  },
  { key: 'church-movements', endpoint: 'church-movements', fileName: 'movimientos-iglesias', filters: ['dateRange', 'changeType', 'region', 'district', 'church'] },
];

export function findReport(key: string | null | undefined): ReportDefinition | null {
  return REPORTS.find((report) => report.key === key) ?? null;
}
