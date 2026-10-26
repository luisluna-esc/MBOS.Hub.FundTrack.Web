import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { apiErrorCode, apiErrorMessage } from '../../../../core/http/api-error';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { Badge } from '../../../../shared/components/badge/badge';
import { ConfirmDialog, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { Input as AppInput } from '../../../../shared/components/input/input';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';
import { Switch } from '../../../../shared/components/switch/switch';
import { ShortcutDirective } from '../../../../shared/directives/shortcut.directive';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CatalogLookups } from '../../../catalogs/catalog-lookups';
import { isStartedPeriod, Period } from '../../../catalogs/catalog.models';
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
// El mes se elige entre los abiertos del año en curso hasta el mes actual (los que toca registrar);
// los meses cerrados se ven aparte, con "Ver meses cerrados", y solo para consulta.
@Component({
  selector: 'app-counts-month',
  imports: [FormsModule, AppInput, Badge, ErrorState, Select, Skeleton, Switch, ShortcutDirective, MoneyPipe, TranslatePipe],
  templateUrl: './counts-month.html',
})
export class CountsMonth {
  private readonly languageService = inject(LanguageService);
  private readonly dialogService = inject(DialogService);
  private readonly fundsService = inject(FundsService);
  private readonly periodService = inject(PeriodService);
  private readonly lookups = inject(CatalogLookups);
  private readonly toastService = inject(ToastService);
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
  /** Ver meses cerrados (solo consulta) en lugar de los abiertos del año. */
  protected readonly showClosed = signal(false);
  protected readonly deletingId = signal<number | null>(null);

  protected readonly period = computed(() => this.periods().find((p) => String(p.periodId) === this.selectedPeriod()) ?? null);

  /** Abiertos del año en curso hasta el mes actual (los meses futuros todavía no se registran). */
  protected readonly openPeriods = computed(() => {
    const year = new Date().getFullYear();
    return this.periods().filter((p) => p.status === 'open' && p.year === year && isStartedPeriod(p));
  });
  /** Cerrados de cualquier año, el más reciente primero. */
  protected readonly closedPeriods = computed(() => this.periods().filter((p) => p.status === 'closed'));

  protected readonly periodOptions = computed<SelectOption[]>(() =>
    (this.showClosed() ? this.closedPeriods() : this.openPeriods()).map((p) => ({ value: String(p.periodId), label: this.periodLabel(p) }))
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

  private async loadPeriods(): Promise<void> {
    try {
      const periods = (await this.periodService.all()).sort((a, b) => b.year - a.year || b.month - a.month);
      this.periods.set(periods);
      this.selectDefaultPeriod();
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

  /**
   * Abiertos: el más antiguo (el que toca registrar). Cerrados: el más reciente. Si no hay abiertos
   * en el año, se pasa a los cerrados para que la pantalla no quede vacía.
   */
  private selectDefaultPeriod(): void {
    if (!this.showClosed() && !this.openPeriods().length && this.closedPeriods().length) {
      this.showClosed.set(true);
    }
    const list = this.showClosed() ? this.closedPeriods() : this.openPeriods();
    const initial = this.showClosed() ? list[0] : list[list.length - 1];
    this.selectedPeriod.set(initial ? String(initial.periodId) : null);
  }

  protected onShowClosedChange(value: boolean): void {
    this.showClosed.set(value);
    this.selectDefaultPeriod();
    void this.loadRows();
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

  /** Elimina el arqueo (con su seguimiento y adjuntos) para volver a registrarlo. Solo en un mes abierto. */
  protected confirmDelete(row: PeriodCountRow): void {
    const count = row.localFundCount;
    const period = this.period();
    if (!count || !period || !this.canEdit()) return;
    const t = (key: string, params?: Record<string, string | number>) => this.languageService.t(key, params);
    this.dialogService
      .open<boolean, ConfirmDialogData>(ConfirmDialog, {
        data: {
          title: t('funds.counts.deleteTitle'),
          message: t('funds.counts.deleteMessage', { church: row.churchName, period: this.periodLabel(period) }),
          confirmLabel: t('catalogs.actions.delete'),
        },
      })
      .closed.subscribe((confirmed) => confirmed && void this.deleteCount(count.localFundCountId));
  }

  private async deleteCount(id: number): Promise<void> {
    this.deletingId.set(id);
    try {
      await this.fundsService.delete(id);
      this.toastService.show(this.languageService.t('common.deleted'));
      await this.loadRows();
    } catch (error) {
      this.toastService.show(this.languageService.t('funds.counts.deleteError'), apiErrorMessage(error) ?? undefined);
    } finally {
      this.deletingId.set(null);
    }
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
