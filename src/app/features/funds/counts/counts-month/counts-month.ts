import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { apiErrorCode } from '../../../../core/http/api-error';
import { LanguageService } from '../../../../core/i18n/language.service';
import { Badge } from '../../../../shared/components/badge/badge';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { Input as AppInput } from '../../../../shared/components/input/input';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CatalogLookups } from '../../../catalogs/catalog-lookups';
import { Period } from '../../../catalogs/catalog.models';
import { PeriodService } from '../../../catalogs/catalog.services';
import { countStatus, differenceClass } from '../../count-status';
import { PeriodCountRow } from '../../funds.models';
import { FundsService } from '../../funds.service';
import { CountDialog, CountDialogData } from '../count-dialog/count-dialog';

type StatusFilter = 'all' | 'missing' | 'notSubmitted' | 'withDifference' | 'ok';

interface DistrictGroup {
  districtId: number;
  region: string;
  district: string;
  pastor: string | null;
  rows: PeriodCountRow[];
}

// Registro de arqueos: la vista del mes tipo Excel, una fila por Iglesia o Grupo (las Filiales van
// dentro de su madre). Región y distrito los filtra el backend; estado y búsqueda, la pantalla.
@Component({
  selector: 'app-counts-month',
  imports: [FormsModule, AppInput, Badge, ErrorState, Select, Skeleton, MoneyPipe, TranslatePipe],
  templateUrl: './counts-month.html',
})
export class CountsMonth {
  private readonly languageService = inject(LanguageService);
  private readonly dialogService = inject(DialogService);
  private readonly fundsService = inject(FundsService);
  private readonly periodService = inject(PeriodService);
  private readonly lookups = inject(CatalogLookups);
  protected readonly authService = inject(AuthService);

  protected readonly periods = signal<Period[]>([]);
  protected readonly rows = signal<PeriodCountRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorCode = signal<number | null>(null);

  protected readonly selectedPeriod = signal<string | null>(null);
  protected readonly selectedRegion = signal<string | null>(null);
  protected readonly selectedDistrict = signal<string | null>(null);
  protected readonly selectedStatus = signal<StatusFilter>('all');
  protected readonly search = signal('');

  protected readonly period = computed(() => this.periods().find((p) => String(p.periodId) === this.selectedPeriod()) ?? null);

  protected readonly periodOptions = computed<SelectOption[]>(() =>
    this.periods().map((p) => ({
      value: String(p.periodId),
      label: `${this.periodLabel(p)}${p.status === 'closed' ? ` (${this.languageService.t('catalogs.periods.states.closed')})` : ''}`,
    }))
  );
  protected readonly regionOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.languageService.t('funds.filters.allRegions') },
    ...this.lookups.regionOptions(),
  ]);
  protected readonly districtOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.languageService.t('funds.filters.allDistricts') },
    ...this.lookups.districtOptions(this.selectedRegion()),
  ]);
  protected readonly statusOptions = computed<SelectOption[]>(() =>
    (['all', 'missing', 'notSubmitted', 'withDifference', 'ok'] as StatusFilter[]).map((value) => ({
      value,
      label: this.languageService.t(`funds.filters.status.${value}`),
    }))
  );

  protected readonly filteredRows = computed(() => {
    const status = this.selectedStatus();
    const search = this.search().trim().toLowerCase();

    return this.rows().filter((row) => {
      const count = row.localFundCount;
      const matchesStatus =
        status === 'all' ||
        (status === 'missing' && !count) ||
        (status === 'notSubmitted' && count?.submissionStatus === 'not_submitted') ||
        (status === 'withDifference' && !!count && count.submissionStatus === 'submitted' && count.difference !== 0) ||
        (status === 'ok' && count?.submissionStatus === 'submitted' && count.difference === 0);

      return matchesStatus && (!search || row.churchName.toLowerCase().includes(search) || row.churchCode.toLowerCase().includes(search));
    });
  });

  /** Región, distrito y pastor como filas de título, igual que en el Excel. */
  protected readonly groups = computed<DistrictGroup[]>(() => {
    const groups = new Map<number, DistrictGroup>();
    for (const row of this.filteredRows()) {
      let group = groups.get(row.districtId);
      if (!group) {
        group = { districtId: row.districtId, region: row.regionName ?? '', district: row.districtName ?? '', pastor: row.pastorName, rows: [] };
        groups.set(row.districtId, group);
      }
      group.rows.push(row);
    }
    return [...groups.values()];
  });

  protected readonly summary = computed(() => {
    const rows = this.rows();
    const registered = rows.filter((r) => r.localFundCount).length;
    return {
      total: rows.length,
      registered,
      missing: rows.length - registered,
      notSubmitted: rows.filter((r) => r.localFundCount?.submissionStatus === 'not_submitted').length,
      withDifference: rows.filter((r) => r.localFundCount?.submissionStatus === 'submitted' && r.localFundCount.difference !== 0).length,
    };
  });

  /** Se registra o edita solo en un período abierto y con un rol que escribe. */
  protected readonly canEdit = computed(() => this.authService.canWrite() && this.period()?.status === 'open');

  protected readonly countStatus = countStatus;
  protected readonly differenceClass = differenceClass;

  constructor() {
    void this.lookups.load('regions', 'districts');
    void this.loadPeriods();
  }

  /** Por defecto el período abierto más antiguo (el que toca registrar); si no hay, el último. */
  private async loadPeriods(): Promise<void> {
    try {
      const periods = (await this.periodService.all()).sort((a, b) => b.year - a.year || b.month - a.month);
      this.periods.set(periods);
      const open = periods.filter((p) => p.status === 'open');
      const initial = open.length ? open[open.length - 1] : periods[0];
      this.selectedPeriod.set(initial ? String(initial.periodId) : null);
      await this.loadRows();
    } catch (error) {
      this.errorCode.set(apiErrorCode(error));
      this.loading.set(false);
    }
  }

  protected async loadRows(): Promise<void> {
    const periodId = this.selectedPeriod();
    if (!periodId) {
      this.rows.set([]);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.errorCode.set(null);
    try {
      this.rows.set(await this.fundsService.byPeriod(Number(periodId), this.selectedRegion(), this.selectedDistrict()));
    } catch (error) {
      this.errorCode.set(apiErrorCode(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected onPeriodChange(value: string | null): void {
    this.selectedPeriod.set(value);
    void this.loadRows();
  }

  protected onRegionChange(value: string | null): void {
    this.selectedRegion.set(value || null);
    this.selectedDistrict.set(null);
    void this.loadRows();
  }

  protected onDistrictChange(value: string | null): void {
    this.selectedDistrict.set(value || null);
    void this.loadRows();
  }

  /** Limpiar: deja todo menos el mes elegido (región, distrito, estado y búsqueda). */
  protected clearFilters(): void {
    this.selectedRegion.set(null);
    this.selectedDistrict.set(null);
    this.selectedStatus.set('all');
    this.search.set('');
    void this.loadRows();
  }

  protected periodLabel(period: { year: number; month: number }): string {
    return `${this.languageService.t(`months.${period.month}`)} ${period.year}`;
  }

  protected openCount(row: PeriodCountRow): void {
    const period = this.period();
    if (!period) return;
    if (!row.localFundCount && !this.canEdit()) return;
    this.dialogService
      .open<boolean, CountDialogData>(CountDialog, { data: { row, period, periodLabel: this.periodLabel(period) } })
      .closed.subscribe((changed) => changed && void this.loadRows());
  }
}
