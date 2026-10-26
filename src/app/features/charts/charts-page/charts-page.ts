import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiErrorCode } from '../../../core/http/api-error';
import { ApiService } from '../../../core/http/api.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { BarList, BarListItem } from '../../../shared/components/charts/bar-list';
import { ChartCard, LegendItem } from '../../../shared/components/charts/chart-card';
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
import { ChartCounts, Charts } from '../charts.models';

/** Primer año con datos si todavía no hay períodos cargados. */
const FIRST_YEAR = 2026;

// Gráficas del año: cómo van los arqueos mes a mes, cuánto hay en custodia frente al saldo ACMS,
// cuánto falta o sobra, cómo va cada región y qué iglesias tienen más faltante. Una sola consulta
// (GET /api/charts) con año, región y distrito; los meses que todavía no empiezan no salen.
@Component({
  selector: 'app-charts-page',
  imports: [FormsModule, BarList, ChartCard, ColumnChart, LineChart, ErrorState, Select, Skeleton, MoneyPipe, TranslatePipe],
  templateUrl: './charts-page.html',
})
export class ChartsPage {
  private readonly api = inject(ApiService);
  private readonly languageService = inject(LanguageService);
  private readonly periodService = inject(PeriodService);
  private readonly lookups = inject(CatalogLookups);

  private readonly currentYear = new Date().getFullYear();

  protected readonly year = signal(String(this.currentYear));
  protected readonly regionId = signal<string | null>(null);
  protected readonly districtId = signal<string | null>(null);
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
  protected readonly regionOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.t('funds.filters.allRegions') },
    ...this.lookups.regionOptions(),
  ]);
  protected readonly districtOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.t('funds.filters.allDistricts') },
    ...this.lookups.districtOptions(this.regionId()),
  ]);

  protected readonly months = computed(() => this.data()?.months ?? []);
  protected readonly monthShort = computed(() => this.months().map((m) => this.t(`months.${m.month}`).slice(0, 3)));
  protected readonly monthTitles = computed(() => this.months().map((m) => `${this.t(`months.${m.month}`)} ${this.data()?.year}`));

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
    return [
      { key: 'acms', label: this.t('charts.amounts.acms'), color: 'var(--color-chart-1)', values: this.months().map((m) => (presented(m) ? m.acmsSubmitted : null)) },
      { key: 'custody', label: this.t('charts.amounts.custody'), color: 'var(--color-chart-2)', values: this.months().map((m) => (presented(m) ? m.custodyTotal : null)) },
    ];
  });

  protected readonly balanceSeries = computed<ChartSeries[]>(() => [
    { key: 'surplus', label: this.t('charts.balance.surplus'), color: 'var(--color-chart-pos)', values: this.months().map((m) => m.surplus) },
    { key: 'shortage', label: this.t('charts.balance.shortage'), color: 'var(--color-chart-neg)', values: this.months().map((m) => m.shortage) },
  ]);

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

  constructor() {
    void this.lookups.load('regions', 'districts');
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
      this.data.set(await this.api.get<Charts>('/charts', { year: this.year(), regionId: this.regionId(), districtId: this.districtId() }));
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

  protected onRegionChange(value: string | null): void {
    this.regionId.set(value || null);
    this.districtId.set(null);
    void this.load();
  }

  protected onDistrictChange(value: string | null): void {
    this.districtId.set(value || null);
    void this.load();
  }

  protected clearFilters(): void {
    this.year.set(String(this.currentYear));
    this.regionId.set(null);
    this.districtId.set(null);
    void this.load();
  }

  protected presented(counts: ChartCounts): number {
    return counts.noDifference + counts.withDifference;
  }

  /** Arqueos presentados sobre los que se debían presentar, en porcentaje entero. */
  protected percent(counts: ChartCounts): number {
    return counts.expected ? Math.round((this.presented(counts) / counts.expected) * 100) : 0;
  }

  protected t(key: string, params?: Record<string, string | number>): string {
    return this.languageService.t(key, params);
  }
}
