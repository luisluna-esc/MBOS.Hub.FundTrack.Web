/** ChartCountsDto: en qué quedaron las iglesias que debían presentar arqueo, y los montos. */
export interface ChartCounts {
  expected: number;
  noDifference: number;
  withDifference: number;
  notSubmitted: number;
  missing: number;
  /** Saldo ACMS de los arqueos presentados. */
  acmsSubmitted: number;
  custodyTotal: number;
  /** Suma de diferencias negativas (falta dinero). */
  shortage: number;
  /** Suma de diferencias positivas (sobra dinero). */
  surplus: number;
}

export interface ChartMonth extends ChartCounts {
  month: number;
}

export interface ChartRegion extends ChartCounts {
  regionId: number;
  regionName: string;
}

export interface ChartChurch {
  churchCode: string;
  churchName: string;
  districtName: string;
  months: number;
  shortage: number;
}

export type ChurchMonthStatus = 'missing' | 'notSubmitted' | 'noDifference' | 'withDifference' | 'resolved';

/** Un mes de la iglesia elegida. */
export interface ChartChurchMonth {
  month: number;
  status: ChurchMonthStatus;
  submitted: boolean;
  summaryOnly: boolean;
  acmsBalance: number;
  totalAmount: number;
  difference: number;
  observation: string | null;
}

/** ChartChurchDetailDto: la iglesia elegida, con cada mes del año. */
export interface ChartChurchDetail {
  churchCode: string;
  churchName: string;
  churchType: string;
  districtName: string;
  regionName: string;
  pastorName: string | null;
  months: ChartChurchMonth[];
}

/** ChartsDto de GET /api/charts. Con iglesia elegida solo viene church. */
export interface Charts {
  year: number;
  totals: ChartCounts;
  months: ChartMonth[];
  regions: ChartRegion[];
  topShortages: ChartChurch[];
  church: ChartChurchDetail | null;
}
