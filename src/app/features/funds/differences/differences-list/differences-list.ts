import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { apiErrorCode } from '../../../../core/http/api-error';
import { QueryParams } from '../../../../core/http/api.models';
import { LanguageService } from '../../../../core/i18n/language.service';
import { Badge } from '../../../../shared/components/badge/badge';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CatalogLookups } from '../../../catalogs/catalog-lookups';
import { countStatus, differenceClass } from '../../count-status';
import { LocalFundCount } from '../../funds.models';
import { FundsService } from '../../funds.service';
import { FollowUpDialog, FollowUpDialogData } from '../follow-up-dialog/follow-up-dialog';

type Tab = 'pending' | 'resolved';

const PAGE_SIZE = 20;

// Bandeja de diferencias: los arqueos presentados donde lo contado no coincide con el ACMS. Quedan
// pendientes y, si la Misión lo marca, pasan a resueltas; el ACMS es el que cubre lo que falta o
// sobra, este sistema solo lo registra.
@Component({
  selector: 'app-differences-list',
  imports: [FormsModule, Badge, ErrorState, Select, Skeleton, MoneyPipe, TranslatePipe],
  templateUrl: './differences-list.html',
})
export class DifferencesList {
  private readonly dialogService = inject(DialogService);
  private readonly languageService = inject(LanguageService);
  private readonly fundsService = inject(FundsService);
  private readonly lookups = inject(CatalogLookups);
  private readonly authService = inject(AuthService);

  protected readonly tabs: Tab[] = ['pending', 'resolved'];
  protected readonly activeTab = signal<Tab>('pending');
  protected readonly tabCount = signal<Record<Tab, number>>({ pending: 0, resolved: 0 });

  protected readonly counts = signal<LocalFundCount[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly loading = signal(true);
  protected readonly errorCode = signal<number | null>(null);

  protected readonly selectedRegion = signal<string | null>(null);
  protected readonly selectedDistrict = signal<string | null>(null);

  protected readonly regionOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.languageService.t('funds.filters.allRegions') },
    ...this.lookups.regionOptions(),
  ]);
  protected readonly districtOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.languageService.t('funds.filters.allDistricts') },
    ...this.lookups.districtOptions(this.selectedRegion()),
  ]);

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalRecords() / PAGE_SIZE)));

  protected readonly countStatus = countStatus;
  protected readonly differenceClass = differenceClass;

  constructor() {
    void this.lookups.load('regions', 'districts');
    void this.reload();
  }

  private filters(status: Tab): QueryParams {
    return { submissionStatus: 'submitted', differenceStatus: status, regionId: this.selectedRegion(), districtId: this.selectedDistrict() };
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.errorCode.set(null);
    try {
      const [page, ...totals] = await Promise.all([
        this.fundsService.list(this.pageNumber(), PAGE_SIZE, this.filters(this.activeTab())),
        ...this.tabs.map((tab) => this.fundsService.list(1, 1, this.filters(tab))),
      ]);
      this.counts.set(page.items);
      this.totalRecords.set(page.totalRecords);
      this.tabCount.set({ pending: totals[0].totalRecords, resolved: totals[1].totalRecords });
    } catch (error) {
      this.errorCode.set(apiErrorCode(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected selectTab(tab: Tab): void {
    this.activeTab.set(tab);
    this.pageNumber.set(1);
    void this.reload();
  }

  protected onRegionChange(value: string | null): void {
    this.selectedRegion.set(value || null);
    this.selectedDistrict.set(null);
    this.pageNumber.set(1);
    void this.reload();
  }

  protected onDistrictChange(value: string | null): void {
    this.selectedDistrict.set(value || null);
    this.pageNumber.set(1);
    void this.reload();
  }

  protected clearFilters(): void {
    this.selectedRegion.set(null);
    this.selectedDistrict.set(null);
    this.pageNumber.set(1);
    void this.reload();
  }

  protected goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.pageNumber.set(page);
    void this.reload();
  }

  protected lastChange(count: LocalFundCount): string {
    const at = count.updatedAt ?? count.createdAt;
    const by = count.updatedByFullName ?? count.createdByFullName;
    return `${new Date(at).toLocaleDateString()}${by ? ` · ${by}` : ''}`;
  }

  protected monthLabel(count: LocalFundCount): string {
    return `${this.languageService.t(`months.${count.periodMonth}`)} ${count.periodYear}`;
  }

  protected openFollowUp(count: LocalFundCount): void {
    this.dialogService
      .open<boolean, FollowUpDialogData>(FollowUpDialog, { data: { count, periodLabel: this.monthLabel(count), canWrite: this.authService.canWrite() } })
      .closed.subscribe((saved) => saved && void this.reload());
  }
}
