import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiErrorCode } from '../../../core/http/api-error';
import { ApiService } from '../../../core/http/api.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { Badge, BadgeTone } from '../../../shared/components/badge/badge';
import { BarList, BarListItem } from '../../../shared/components/charts/bar-list';
import { ChartCard, LegendItem } from '../../../shared/components/charts/chart-card';
import { cell, ChartReport, reportSeries } from '../../../shared/components/charts/chart-report';
import { ChartSeries, formatMoney } from '../../../shared/components/charts/chart-utils';
import { ColumnChart } from '../../../shared/components/charts/column-chart';
import { LineChart } from '../../../shared/components/charts/line-chart';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Select, SelectOption } from '../../../shared/components/select/select';
import { Skeleton } from '../../../shared/components/skeleton/skeleton';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { CatalogLookups } from '../../catalogs/catalog-lookups';
import { PeriodService } from '../../catalogs/catalog.services';
import { ChartChurchMonth, ChartCounts, Charts, ChurchMonthStatus } from '../charts.models';

/** Primer año con datos si todavía no hay períodos cargados. */
const FIRST_YEAR = 2026;

/** Color y texto de cada estado del mes de una iglesia (el mismo criterio que el registro). */
const MONTH_STATUS: Record<ChurchMonthStatus, BadgeTone> = {
  missing: 'neutral',
  notSubmitted: 'danger',
  noDifference: 'success',
  withDifference: 'warning',
  resolved: 'success',
};

// Gráficas del año. Sin iglesia elegida: cómo van los arqueos de todas mes a mes, cuánto hay en
// custodia frente al saldo ACMS, cuánto falta o sobra, cada región y las iglesias con más faltante.
// Con una iglesia: su fondo local mes a mes (sus altas y bajas), lo que le sobró o faltó y en qué
// quedó cada mes. Filtros: año, distrito e iglesia (la iglesia llena sola su distrito).
@Component({
  selector: 'app-charts-page',
  imports: [FormsModule, Badge, BarList, ChartCard, ColumnChart, LineChart, ErrorState, Select, Skeleton, MoneyPipe, TranslatePipe],
  templateUrl: './charts-page.html',
})
export class ChartsPage {
  private readonly api = inject(ApiService);
  private readonly languageService = inject(LanguageService);
  private readonly periodService = inject(PeriodService);
  private readonly lookups = inject(CatalogLookups);

  private readonly currentYear = new Date().getFullYear();

  protected readonly year = signal(String(this.currentYear));
  protected readonly districtId = signal<string | null>(null);
  protected readonly churchId = signal<string | null>(null);
  protected readonly firstYear = signal(FIRST_YEAR);

  protected readonly data = signal<Charts | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorCode = signal<number | null>(null);

  protected readonly money = formatMoney;

  protected readonly yearOptions = computed<SelectOption[]>(() => {
    const years: SelectOption[] = [];
    for (let y = this.currentYear; y >= Math.min(this.firstYear(), this.currentYear); y--) years.push({ value: String(y), label: String(y) });
    return years;
  });
  protected readonly districtOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.t('funds.filters.allDistricts') },
    ...this.lookups.districtOptions(null),
  ]);
  /** Iglesias y Grupos (las filiales van dentro de su madre), del distrito elegido o de todos. */
  protected readonly churchOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.t('reports.filters.allChurches') },
    ...this.lookups
      .churches()
      .filter((c) => c.type !== 'Filial' && (!this.districtId() || String(c.districtId) === this.districtId()))
      .map((c) => ({ value: String(c.churchId), label: `${c.code} ${c.name}` })),
  ]);

  // ---------------------------------------------------------------------------------------------
  // Todas las iglesias
  // ---------------------------------------------------------------------------------------------

  protected readonly months = computed(() => this.data()?.months ?? []);
  protected readonly monthShort = computed(() => this.months().map((m) => this.short(m.month)));
  protected readonly monthTitles = computed(() => this.months().map((m) => this.title(m.month)));

  /** Orden fijo de colores: sin diferencia, con diferencia, no presentó; sin registrar en gris. */
  protected readonly statusSeries = computed<ChartSeries[]>(() => [
    { key: 'ok', label: this.t('charts.status.noDifference'), color: 'var(--color-chart-1)', values: this.months().map((m) => m.noDifference) },
    { key: 'diff', label: this.t('charts.status.withDifference'), color: 'var(--color-chart-2)', values: this.months().map((m) => m.withDifference) },
    { key: 'ns', label: this.t('charts.status.notSubmitted'), color: 'var(--color-chart-3)', values: this.months().map((m) => m.notSubmitted) },
    { key: 'missing', label: this.t('charts.status.missing'), color: 'var(--color-chart-neutral)', values: this.months().map((m) => m.missing) },
  ]);

  /** Un mes sin arqueos presentados no tiene montos: se corta la línea en vez de bajar a cero. */
  protected readonly amountSeries = computed<ChartSeries[]>(() => {
    const presented = (m: ChartCounts) => m.noDifference + m.withDifference > 0;
    return this.amountPair(
      this.months().map((m) => (presented(m) ? m.acmsSubmitted : null)),
      this.months().map((m) => (presented(m) ? m.custodyTotal : null))
    );
  });

  protected readonly balanceSeries = computed<ChartSeries[]>(() =>
    this.balancePair(
      this.months().map((m) => m.surplus),
      this.months().map((m) => m.shortage)
    )
  );

  protected readonly regionItems = computed<BarListItem[]>(() =>
    (this.data()?.regions ?? [])
      .map((r) => ({ region: r, value: this.percent(r) }))
      .sort((a, b) => b.value - a.value)
      .map(({ region, value }) => ({
        key: String(region.regionId),
        label: region.regionName,
        value,
        tooltip: this.t('charts.regions.tooltip', { done: this.presented(region), total: region.expected }),
      }))
  );

  protected readonly shortageItems = computed<BarListItem[]>(() =>
    (this.data()?.topShortages ?? []).map((c) => ({
      key: c.churchCode + c.churchName,
      label: `${c.churchCode} ${c.churchName}`,
      detail: c.districtName,
      value: c.shortage,
      tooltip: this.t('charts.shortages.tooltip', { months: c.months }),
    }))
  );

  protected readonly legendStatus = computed<LegendItem[]>(() => this.statusSeries().map((s) => ({ label: s.label, color: s.color })));
  protected readonly legendAmounts = computed<LegendItem[]>(() => this.amountSeries().map((s) => ({ label: s.label, color: s.color, shape: 'line' as const })));
  protected readonly legendBalance = computed<LegendItem[]>(() => this.balanceSeries().map((s) => ({ label: s.label, color: s.color })));

  protected readonly formatPercent = (value: number) => `${value}%`;

  // ---------------------------------------------------------------------------------------------
  // Una iglesia
  // ---------------------------------------------------------------------------------------------

  protected readonly church = computed(() => this.data()?.church ?? null);
  protected readonly churchMonths = computed(() => this.church()?.months ?? []);
  protected readonly churchShort = computed(() => this.churchMonths().map((m) => this.short(m.month)));
  protected readonly churchTitles = computed(() => this.churchMonths().map((m) => this.title(m.month)));
  protected readonly churchSubmitted = computed(() => this.churchMonths().filter((m) => m.submitted));

  protected readonly churchAmountSeries = computed<ChartSeries[]>(() =>
    this.amountPair(
      this.churchMonths().map((m) => (m.submitted ? m.acmsBalance : null)),
      this.churchMonths().map((m) => (m.submitted ? m.totalAmount : null))
    )
  );
  protected readonly churchBalanceSeries = computed<ChartSeries[]>(() =>
    this.balancePair(
      this.churchMonths().map((m) => (m.difference > 0 ? m.difference : 0)),
      this.churchMonths().map((m) => (m.difference < 0 ? m.difference : 0))
    )
  );
  protected readonly churchLegendAmounts = computed<LegendItem[]>(() =>
    this.churchAmountSeries().map((s) => ({ label: s.label, color: s.color, shape: 'line' as const }))
  );
  protected readonly churchLegendBalance = computed<LegendItem[]>(() => this.churchBalanceSeries().map((s) => ({ label: s.label, color: s.color })));

  /** Las altas y bajas: el mes con más y con menos saldo ACMS entre los que presentó arqueo. */
  protected readonly churchHighest = computed(() => this.extreme((a, b) => b.acmsBalance - a.acmsBalance));
  protected readonly churchLowest = computed(() => this.extreme((a, b) => a.acmsBalance - b.acmsBalance));
  protected readonly churchShortage = computed(() => this.churchSubmitted().reduce((sum, m) => sum + Math.min(0, m.difference), 0));
  protected readonly churchSurplus = computed(() => this.churchSubmitted().reduce((sum, m) => sum + Math.max(0, m.difference), 0));
  protected readonly churchObservations = computed(() => this.churchMonths().filter((m) => m.observation));

  // ---------------------------------------------------------------------------------------------
  // Botón Reporte de cada gráfica: la misma gráfica y su tabla, con los filtros elegidos
  // ---------------------------------------------------------------------------------------------

  /** Los filtros elegidos, como líneas del encabezado del reporte. */
  private readonly reportFilters = computed(() => {
    const lines = [this.t('charts.reportFilters.year', { year: this.year() })];
    const district = this.lookups.districts().find((d) => String(d.districtId) === this.districtId());
    lines.push(district ? this.t('charts.reportFilters.district', { name: district.name }) : this.t('charts.reportFilters.mission'));
    const church = this.church();
    if (church) lines.push(this.t('charts.reportFilters.church', { name: `${church.churchCode} ${church.churchName}` }));
    return lines;
  });

  private buildReport(key: string, titleKey: string, subtitleKey: string, report: Omit<ChartReport, 'title' | 'subtitle' | 'filters' | 'fileName'>): ChartReport {
    const church = this.church();
    return {
      ...report,
      title: this.t(titleKey),
      subtitle: this.t(subtitleKey),
      filters: this.reportFilters(),
      fileName: `grafica-${key}-${this.year()}${church ? `-${church.churchCode}` : ''}`,
    };
  }

  protected readonly statusReport = computed(() =>
    this.buildReport('estado-arqueos', 'charts.status.title', 'charts.status.subtitle', {
      chartType: 'column',
      valueFormat: 'integer',
      categories: this.monthShort(),
      series: reportSeries(this.statusSeries()),
      headers: [this.t('charts.month'), ...this.statusSeries().map((s) => s.label), this.t('charts.status.expected')],
      columnFormats: ['text', 'integer', 'integer', 'integer', 'integer', 'integer'],
      rows: this.months().map((m, i) => [this.monthTitles()[i], cell(m.noDifference), cell(m.withDifference), cell(m.notSubmitted), cell(m.missing), cell(m.expected)]),
    })
  );

  protected readonly amountsReport = computed(() =>
    this.buildReport('acms-custodia', 'charts.amounts.title', 'charts.amounts.subtitle', {
      chartType: 'line',
      valueFormat: 'money',
      categories: this.monthShort(),
      series: reportSeries(this.amountSeries()),
      headers: [this.t('charts.month'), this.t('charts.amounts.acms'), this.t('charts.amounts.custody')],
      columnFormats: ['text', 'money', 'money'],
      rows: this.months().map((m, i) => [this.monthTitles()[i], cell(m.acmsSubmitted), cell(m.custodyTotal)]),
    })
  );

  protected readonly balanceReport = computed(() =>
    this.buildReport('sobra-falta', 'charts.balance.title', 'charts.balance.subtitle', {
      chartType: 'column',
      valueFormat: 'money',
      categories: this.monthShort(),
      series: reportSeries(this.balanceSeries()),
      headers: [this.t('charts.month'), this.t('charts.balance.surplus'), this.t('charts.balance.shortage')],
      columnFormats: ['text', 'money', 'money'],
      rows: this.months().map((m, i) => [this.monthTitles()[i], cell(m.surplus), cell(m.shortage)]),
    })
  );

  protected readonly regionsReport = computed(() => {
    const regions = [...(this.data()?.regions ?? [])].sort((a, b) => this.percent(b) - this.percent(a));
    return this.buildReport('regiones', 'charts.regions.title', 'charts.regions.subtitle', {
      chartType: 'bars',
      valueFormat: 'percent',
      categories: regions.map((r) => r.regionName),
      series: [{ label: '%', color: 'chart-1', values: regions.map((r) => this.percent(r)) }],
      headers: [this.t('funds.filters.region'), this.t('charts.regions.presented'), this.t('charts.status.expected'), '%'],
      columnFormats: ['text', 'integer', 'integer', 'percent'],
      rows: regions.map((r) => [r.regionName, cell(this.presented(r)), cell(r.expected), cell(this.percent(r))]),
    });
  });

  protected readonly shortagesReport = computed(() => {
    const churches = this.data()?.topShortages ?? [];
    return this.buildReport('mas-faltante', 'charts.shortages.title', 'charts.shortages.subtitle', {
      chartType: 'bars',
      valueFormat: 'money',
      categories: churches.map((c) => `${c.churchCode} ${c.churchName}`),
      series: [{ label: this.t('charts.balance.shortage'), color: 'chart-neg', values: churches.map((c) => c.shortage) }],
      headers: [this.t('funds.columns.church'), this.t('funds.filters.district'), this.t('charts.shortages.months'), this.t('charts.balance.shortage')],
      columnFormats: ['text', 'text', 'integer', 'money'],
      rows: churches.map((c) => [`${c.churchCode} ${c.churchName}`, c.districtName, cell(c.months), cell(c.shortage)]),
    });
  });

  protected readonly churchFundReport = computed(() =>
    this.buildReport('fondo-local', 'charts.church.fundTitle', 'charts.church.fundSubtitle', {
      chartType: 'line',
      valueFormat: 'money',
      categories: this.churchShort(),
      series: reportSeries(this.churchAmountSeries()),
      headers: [this.t('charts.month'), this.t('funds.columns.status'), this.t('charts.amounts.acms'), this.t('charts.amounts.custody'), this.t('funds.columns.difference')],
      columnFormats: ['text', 'text', 'money', 'money', 'money'],
      rows: this.churchMonths().map((m, i) => [
        this.churchTitles()[i],
        this.t(`funds.status.${m.status}`),
        m.submitted ? cell(m.acmsBalance) : null,
        m.submitted ? cell(m.totalAmount) : null,
        m.submitted ? cell(m.difference) : null,
      ]),
    })
  );

  protected readonly churchBalanceReport = computed(() =>
    this.buildReport('sobra-falta', 'charts.balance.title', 'charts.church.balanceSubtitle', {
      chartType: 'column',
      valueFormat: 'money',
      categories: this.churchShort(),
      series: reportSeries(this.churchBalanceSeries()),
      headers: [this.t('charts.month'), this.t('funds.columns.difference')],
      columnFormats: ['text', 'money'],
      rows: this.churchMonths().map((m, i) => [this.churchTitles()[i], m.submitted ? cell(m.difference) : null]),
    })
  );

  protected readonly churchStatusReport = computed(() =>
    this.buildReport('estado-meses', 'charts.church.statusTitle', 'charts.church.statusSubtitle', {
      chartType: 'none',
      valueFormat: 'integer',
      categories: [],
      series: [],
      headers: [this.t('charts.month'), this.t('funds.columns.status'), this.t('charts.church.observations')],
      columnFormats: ['text', 'text', 'text'],
      rows: this.churchMonths().map((m, i) => [this.churchTitles()[i], this.t(`funds.status.${m.status}`), m.observation]),
    })
  );

  constructor() {
    void this.lookups.load('districts', 'churches');
    this.periodService
      .all()
      .then((periods) => periods.length && this.firstYear.set(Math.min(...periods.map((p) => p.year))))
      .catch(() => undefined);
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorCode.set(null);
    try {
      this.data.set(
        await this.api.get<Charts>('/charts', { year: this.year(), districtId: this.districtId() || null, churchId: this.churchId() || null })
      );
    } catch (error) {
      this.errorCode.set(apiErrorCode(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected onYearChange(value: string | null): void {
    this.year.set(value ?? String(this.currentYear));
    void this.load();
  }

  protected onDistrictChange(value: string | null): void {
    this.districtId.set(value || null);
    this.churchId.set(null);
    void this.load();
  }

  /** Al elegir la iglesia se llena solo su distrito. */
  protected onChurchChange(value: string | null): void {
    this.churchId.set(value || null);
    const church = value ? this.lookups.churches().find((c) => String(c.churchId) === value) : null;
    if (church) this.districtId.set(String(church.districtId));
    void this.load();
  }

  protected clearFilters(): void {
    this.year.set(String(this.currentYear));
    this.districtId.set(null);
    this.churchId.set(null);
    void this.load();
  }

  protected presented(counts: ChartCounts): number {
    return counts.noDifference + counts.withDifference;
  }

  /** Arqueos presentados sobre los que se debían presentar, en porcentaje entero. */
  protected percent(counts: ChartCounts): number {
    return counts.expected ? Math.round((this.presented(counts) / counts.expected) * 100) : 0;
  }

  protected statusTone(month: ChartChurchMonth): BadgeTone {
    return MONTH_STATUS[month.status];
  }

  protected title(month: number): string {
    return `${this.t(`months.${month}`)} ${this.data()?.year ?? ''}`;
  }

  protected t(key: string, params?: Record<string, string | number>): string {
    return this.languageService.t(key, params);
  }

  private short(month: number): string {
    return this.t(`months.${month}`).slice(0, 3);
  }

  private extreme(order: (a: ChartChurchMonth, b: ChartChurchMonth) => number): ChartChurchMonth | null {
    return [...this.churchSubmitted()].sort(order)[0] ?? null;
  }

  private amountPair(acms: (number | null)[], custody: (number | null)[]): ChartSeries[] {
    return [
      { key: 'acms', label: this.t('charts.amounts.acms'), color: 'var(--color-chart-1)', values: acms },
      { key: 'custody', label: this.t('charts.amounts.custody'), color: 'var(--color-chart-2)', values: custody },
    ];
  }

  private balancePair(surplus: number[], shortage: number[]): ChartSeries[] {
    return [
      { key: 'surplus', label: this.t('charts.balance.surplus'), color: 'var(--color-chart-pos)', values: surplus },
      { key: 'shortage', label: this.t('charts.balance.shortage'), color: 'var(--color-chart-neg)', values: shortage },
    ];
  }
}
