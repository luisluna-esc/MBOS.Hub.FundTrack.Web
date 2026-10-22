import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { localDateIso } from '../../../core/dates/calendar-date';
import { apiErrorMessage } from '../../../core/http/api-error';
import { QueryParams } from '../../../core/http/api.models';
import { ApiService } from '../../../core/http/api.service';
import { ROLES } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { saveBlob } from '../../../core/http/save-blob';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../core/toast/toast.service';
import { DatePicker } from '../../../shared/components/date-picker/date-picker';
import { Select, SelectOption } from '../../../shared/components/select/select';
import { Skeleton } from '../../../shared/components/skeleton/skeleton';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { CatalogLookups } from '../../catalogs/catalog-lookups';
import { Period } from '../../catalogs/catalog.models';
import { PeriodService } from '../../catalogs/catalog.services';
import { ReportDefinition, ReportFilter, findReport } from '../report-definitions';

/** Chrome en Android no muestra PDFs dentro de la página: ahí solo se ofrece descargarlo (igual que InvenTrack). */
const CAN_PREVIEW_PDF = (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled !== false;

// Pantalla única de reportes, mismo funcionamiento que los reportes de InvenTrack: filtros arriba,
// vista previa del PDF y botones para descargar el PDF o el Excel con los mismos filtros. Al
// entrar no se genera nada: el reporte se pide recién cuando el usuario cambia un filtro (con una
// pequeña espera para no pedir de más), así navegar por los reportes no carga al servidor.
@Component({
  selector: 'app-report-page',
  imports: [FormsModule, DatePicker, Select, Skeleton, TranslatePipe],
  templateUrl: './report-page.html',
})
export class ReportPage {
  private readonly api = inject(ApiService);
  private readonly periodService = inject(PeriodService);
  private readonly lookups = inject(CatalogLookups);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly authService = inject(AuthService);

  /** Parámetro :report de la ruta (withComponentInputBinding). */
  readonly report = input<string>();

  protected readonly definition = computed<ReportDefinition | null>(() => findReport(this.report()));
  protected readonly canPreviewPdf = CAN_PREVIEW_PDF;

  private readonly today = localDateIso();
  private readonly currentYear = new Date().getFullYear();

  protected readonly year = signal<string | null>(String(this.currentYear));
  protected readonly monthFrom = signal<string | null>('1');
  protected readonly monthTo = signal<string | null>(String(new Date().getMonth() + 1));
  protected readonly periodId = signal<string | null>(null);
  protected readonly regionId = signal<string | null>(null);
  protected readonly districtId = signal<string | null>(null);
  protected readonly churchId = signal<string | null>(null);
  protected readonly groupBy = signal<'region' | 'district'>('region');
  protected readonly differenceStatus = signal<string | null>(null);
  protected readonly changeType = signal<string | null>(null);
  protected readonly dateFrom = signal<string | null>(`${this.currentYear}-01-01`);
  protected readonly dateTo = signal<string | null>(this.today);

  protected readonly periods = signal<Period[]>([]);
  protected readonly loading = signal(false);
  protected readonly downloading = signal<'pdf' | 'excel' | null>(null);
  protected readonly previewUrl = signal<SafeResourceUrl | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  /** El usuario ya cambió algún filtro en este reporte: recién ahí se genera. */
  private readonly touched = signal(false);

  private objectUrl: string | null = null;
  private pdfBlob: Blob | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  protected has(filter: ReportFilter): boolean {
    return this.definition()?.filters.includes(filter) ?? false;
  }

  /** En el Resumen, la región solo se elige al agrupar por distrito. */
  protected showRegion(): boolean {
    return this.has('region') && (!this.has('groupBy') || this.groupBy() === 'district');
  }

  protected readonly groupByOptions = computed<SelectOption[]>(() => [
    { value: 'region', label: this.languageService.t('reports.filters.byRegion') },
    { value: 'district', label: this.languageService.t('reports.filters.byDistrict') },
  ]);

  /** Nombre del archivo; el Resumen por distrito se llama distinto. */
  private fileName(): string {
    const definition = this.definition();
    if (!definition) return 'reporte';
    return this.has('groupBy') && this.groupBy() === 'district' ? 'resumen-distritos' : definition.fileName;
  }

  protected onGroupByChange(value: string | null): void {
    this.touch();
    this.groupBy.set(value === 'district' ? 'district' : 'region');
    this.regionId.set(null);
    this.districtId.set(null);
  }

  protected readonly yearOptions = computed<SelectOption[]>(() => {
    const years = new Set(this.periods().map((p) => p.year));
    years.add(this.currentYear);
    return [...years].sort((a, b) => b - a).map((y) => ({ value: String(y), label: String(y) }));
  });

  protected readonly monthOptions = computed<SelectOption[]>(() =>
    Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: this.languageService.t(`months.${i + 1}`) }))
  );

  protected readonly periodOptions = computed<SelectOption[]>(() =>
    this.periods().map((p) => ({ value: String(p.periodId), label: `${this.languageService.t(`months.${p.month}`)} ${p.year}` }))
  );

  protected readonly regionOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.languageService.t('funds.filters.allRegions') },
    ...this.lookups.regionOptions(),
  ]);

  protected readonly districtOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.languageService.t('funds.filters.allDistricts') },
    ...this.lookups.districtOptions(this.regionId()),
  ]);

  /** Iglesias y Grupos (las filiales van dentro del arqueo de su madre) del distrito o la región elegidos. */
  protected readonly churchOptions = computed<SelectOption[]>(() => {
    const districtIds = new Set(this.lookups.districtOptions(this.regionId()).map((d) => d.value));
    return [
      { value: '', label: this.languageService.t('reports.filters.allChurches') },
      ...this.lookups
        .churches()
        .filter((c) => c.type !== 'Filial' && (this.districtId() ? String(c.districtId) === this.districtId() : districtIds.has(String(c.districtId))))
        .map((c) => ({ value: String(c.churchId), label: `${c.code} ${c.name}` })),
    ];
  });

  /** Un Pastor ya está limitado a su distrito por el backend: no necesita elegirlo. */
  protected readonly missingDistrict = computed(
    () => !!this.definition()?.needsDistrictOrChurch && !this.districtId() && !this.churchId() && this.authService.activeRole() !== ROLES.pastor
  );

  protected readonly statusOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.languageService.t('reports.filters.allStatuses') },
    ...(['pending', 'resolved'] as const).map((s) => ({ value: s, label: this.languageService.t(`funds.status.${s}`) })),
  ]);

  protected readonly changeTypeOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.languageService.t('reports.filters.allChanges') },
    ...(['status', 'district', 'type', 'name'] as const).map((t) => ({ value: t, label: this.languageService.t(`catalogs.churches.changeTypes.${t}`) })),
  ]);

  constructor() {
    void this.lookups.load('regions', 'districts', 'churches');
    this.periodService
      .all()
      .then((periods) => {
        const sorted = periods.sort((a, b) => b.year - a.year || b.month - a.month);
        this.periods.set(sorted);
        // Pendientes: por defecto el mes abierto más antiguo, que es el que se está cerrando.
        const open = sorted.filter((p) => p.status === 'open' && p.dueDate <= this.today);
        const initial = open.length ? open[open.length - 1] : sorted[0];
        if (initial && !this.periodId()) this.periodId.set(String(initial.periodId));
      })
      .catch(() => this.periods.set([]));

    inject(DestroyRef).onDestroy(() => {
      this.revokePreview();
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
    });

    // Al cambiar de reporte se borra la vista previa y se espera a que el usuario toque un filtro.
    effect(() => {
      this.definition();
      untracked(() => {
        this.touched.set(false);
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.revokePreview();
        this.errorMessage.set(null);
      });
    });

    // Después de la primera interacción, cada cambio de filtro vuelve a generar la vista previa.
    effect(() => {
      this.query();
      if (untracked(() => this.touched())) {
        untracked(() => this.scheduleGenerate());
      }
    });
  }

  /** Filtros del reporte con los nombres de su QueryFilter en el backend. */
  protected readonly query = computed<QueryParams | null>(() => {
    const definition = this.definition();
    if (!definition) return null;
    const params: QueryParams = {};
    for (const filter of definition.filters) {
      switch (filter) {
        case 'year':
          params['year'] = this.year();
          break;
        case 'monthRange':
          params['monthFrom'] = this.monthFrom();
          params['monthTo'] = this.monthTo();
          break;
        case 'period':
          if (!this.periodId()) return null;
          params['periodId'] = this.periodId();
          break;
        case 'region':
          if (this.showRegion()) params['regionId'] = this.regionId();
          break;
        case 'groupBy':
          params['groupBy'] = this.groupBy();
          break;
        case 'district':
          params['districtId'] = this.districtId();
          break;
        case 'church':
          params['churchId'] = this.churchId();
          break;
        case 'differenceStatus':
          params['status'] = this.differenceStatus();
          break;
        case 'changeType':
          params['changeType'] = this.changeType();
          break;
        case 'dateRange':
          params['dateFrom'] = this.dateFrom();
          params['dateTo'] = this.dateTo();
          break;
      }
    }
    return this.missingDistrict() ? null : params;
  });

  /** Limpiar: vuelve a los filtros con que abre el reporte y quita la vista previa hasta que se vuelva a elegir. */
  protected clearFilters(): void {
    this.touched.set(false);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.revokePreview();
    this.errorMessage.set(null);
    this.year.set(String(this.currentYear));
    this.monthFrom.set('1');
    this.monthTo.set(String(new Date().getMonth() + 1));
    this.regionId.set(null);
    this.districtId.set(null);
    this.churchId.set(null);
    this.differenceStatus.set(null);
    this.changeType.set(null);
    this.groupBy.set('region');
    this.dateFrom.set(`${this.currentYear}-01-01`);
    this.dateTo.set(this.today);
    const open = this.periods().filter((p) => p.status === 'open' && p.dueDate <= this.today);
    const initial = open.length ? open[open.length - 1] : this.periods()[0];
    this.periodId.set(initial ? String(initial.periodId) : null);
  }

  /** Lo llama cada filtro al cambiar: desde ahí el reporte se genera solo. */
  protected touch(): void {
    if (!this.touched()) {
      this.touched.set(true);
      this.scheduleGenerate();
    }
  }

  protected onRegionChange(value: string | null): void {
    this.touch();
    this.regionId.set(value || null);
    this.districtId.set(null);
    this.churchId.set(null);
  }

  protected onDistrictChange(value: string | null): void {
    this.touch();
    this.districtId.set(value || null);
    this.churchId.set(null);
  }

  protected setOptional(target: { set(value: string | null): void }, value: string | null): void {
    this.touch();
    target.set(value || null);
  }

  private scheduleGenerate(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => void this.generate(), 400);
  }

  private async generate(): Promise<void> {
    const definition = this.definition();
    const query = this.query();
    if (!definition || !query) {
      this.revokePreview();
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const blob = await this.api.download(`/reports/${definition.endpoint}/pdf`, query);
      this.revokePreview();
      this.pdfBlob = blob;
      this.objectUrl = URL.createObjectURL(blob);
      this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
    } catch (error) {
      this.revokePreview();
      this.errorMessage.set((await this.blobErrorMessage(error)) ?? this.languageService.t('reports.error'));
    } finally {
      this.loading.set(false);
    }
  }

  protected downloadPdf(): void {
    const definition = this.definition();
    if (this.pdfBlob && definition) saveBlob(this.pdfBlob, `${this.fileName()}.pdf`);
  }

  protected async downloadExcel(): Promise<void> {
    const definition = this.definition();
    const query = this.query();
    if (!definition || !query) return;
    this.downloading.set('excel');
    try {
      saveBlob(await this.api.download(`/reports/${definition.endpoint}/excel`, query), `${this.fileName()}.xlsx`);
    } catch (error) {
      this.toastService.show(this.languageService.t('reports.excelError'), (await this.blobErrorMessage(error)) ?? undefined);
    } finally {
      this.downloading.set(null);
    }
  }

  /** Con responseType 'blob' el error del backend también llega como Blob: se lee el JSON de adentro. */
  private async blobErrorMessage(error: unknown): Promise<string | null> {
    const body = (error as { error?: unknown })?.error;
    if (body instanceof Blob) {
      try {
        const parsed = JSON.parse(await body.text()) as { messages?: { description: string }[] };
        return parsed.messages?.map((m) => m.description).join(' ') || null;
      } catch {
        return null;
      }
    }
    return apiErrorMessage(error);
  }

  private revokePreview(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.pdfBlob = null;
    this.previewUrl.set(null);
  }
}
