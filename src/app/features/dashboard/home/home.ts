import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiErrorCode } from '../../../core/http/api-error';
import { ApiService } from '../../../core/http/api.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { Badge } from '../../../shared/components/badge/badge';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Select, SelectOption } from '../../../shared/components/select/select';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { Period } from '../../catalogs/catalog.models';
import { PeriodService } from '../../catalogs/catalog.services';
import { Dashboard, DashboardPeriod, DashboardRegionRow } from '../dashboard.models';

const EMPTY_ROW: DashboardRegionRow = {
  regionId: null,
  regionName: '',
  activeChurches: 0,
  submitted: 0,
  notSubmitted: 0,
  missing: 0,
  differencesPending: 0,
  differencesResolved: 0,
  negativeAcms: 0,
  totalAcmsBalance: 0,
  totalCounted: 0,
  totalDifference: 0,
};

const EMPTY_DASHBOARD: Dashboard = { period: null, isOverdue: false, totals: EMPTY_ROW, regions: [], overduePeriods: [] };

// Pantalla de Inicio: resumen del mes por región (GET /api/dashboard). Sin mes elegido, el backend
// muestra el mes en curso o el último anterior a hoy. Un Pastor solo ve su distrito.
@Component({
  selector: 'app-home',
  imports: [FormsModule, Badge, ErrorState, Select, MoneyPipe, TranslatePipe],
  templateUrl: './home.html',
})
export class Home {
  private readonly languageService = inject(LanguageService);
  private readonly api = inject(ApiService);
  private readonly periodService = inject(PeriodService);

  protected readonly dashboard = signal<Dashboard>(EMPTY_DASHBOARD);
  protected readonly periods = signal<Period[]>([]);
  protected readonly selectedPeriod = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorCode = signal<number | null>(null);

  protected readonly totals = computed(() => this.dashboard().totals);

  protected readonly periodOptions = computed<SelectOption[]>(() =>
    this.periods().map((period) => ({ value: String(period.periodId), label: this.periodLabel(period) }))
  );

  /** Porcentaje de Iglesias y Grupos activos que ya tienen su arqueo registrado (presentado o no). */
  protected readonly progress = computed(() => this.percent(this.totals()));

  constructor() {
    this.periodService
      .all()
      .then((periods) => this.periods.set(periods.sort((a, b) => b.year - a.year || b.month - a.month)))
      .catch(() => this.periods.set([]));
    void this.load(null);
  }

  protected async load(periodId: string | null): Promise<void> {
    this.loading.set(true);
    this.errorCode.set(null);
    try {
      const dashboard = await this.api.get<Dashboard>('/dashboard', { periodId });
      this.dashboard.set({ ...EMPTY_DASHBOARD, ...dashboard, totals: dashboard.totals ?? EMPTY_ROW });
      this.selectedPeriod.set(dashboard.period ? String(dashboard.period.periodId) : null);
    } catch (error) {
      this.errorCode.set(apiErrorCode(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected percent(row: DashboardRegionRow): number {
    if (row.activeChurches === 0) {
      return 0;
    }
    return Math.round(((row.submitted + row.notSubmitted) / row.activeChurches) * 100);
  }

  protected periodLabel(period: { year: number; month: number }): string {
    return `${this.languageService.t(`months.${period.month}`)} ${period.year}`;
  }

  protected dueDateLabel(period: DashboardPeriod): string {
    const [year, month, day] = period.dueDate.split('-');
    return `${day}/${month}/${year}`;
  }

  /** Falta dinero en rojo, sobra en celeste, cuadra en gris. */
  protected differenceClass(value: number): string {
    if (value < 0) {
      return 'text-danger';
    }
    return value > 0 ? 'text-info' : 'text-muted-foreground';
  }

  protected onPeriodChange(value: string | null): void {
    this.selectedPeriod.set(value);
    void this.load(value);
  }
}
