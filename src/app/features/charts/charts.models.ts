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

/** ChartsDto de GET /api/charts. */
export interface Charts {
  year: number;
  totals: ChartCounts;
  months: ChartMonth[];
  regions: ChartRegion[];
  topShortages: ChartChurch[];
}
