/** Mismo formato que devuelve GET /api/dashboard (DashboardDto del backend). */
export interface DashboardPeriod {
  periodId: number;
  year: number;
  month: number;
  dueDate: string;
  status: 'open' | 'closed';
}

export interface DashboardRegionRow {
  regionId: number | null;
  regionName: string;
  activeChurches: number;
  submitted: number;
  notSubmitted: number;
  /** Iglesias activas que todavía no tienen arqueo registrado ese mes. */
  missing: number;
  differencesPending: number;
  differencesResolved: number;
  /** Arqueos con saldo ACMS negativo: la iglesia gastó más de lo que tenía. */
  negativeAcms: number;
  totalAcmsBalance: number;
  totalCounted: number;
  totalDifference: number;
}

export interface Dashboard {
  period: DashboardPeriod | null;
  isOverdue: boolean;
  totals: DashboardRegionRow;
  regions: DashboardRegionRow[];
  overduePeriods: DashboardPeriod[];
}
