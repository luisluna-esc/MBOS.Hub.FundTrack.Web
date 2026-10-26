import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
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
import { isStartedPeriod, Period } from '../../catalogs/catalog.models';
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

  private readonly currentYear = new Date().getFullYear();

  // Todos los filtros empiezan vacíos: el reporte se genera recién cuando están elegidos los que
  // necesita (los opcionales, como región o estado, pueden quedar vacíos y valen "todos").
  protected readonly year = signal<string | null>(null);
  protected readonly monthFrom = signal<string | null>(null);
  protected readonly monthTo = signal<string | null>(null);
  protected readonly periodId = signal<string | null>(null);
  protected readonly periodFrom = signal<string | null>(null);
  protected readonly periodTo = signal<string | null>(null);
  protected readonly regionId = signal<string | null>(null);
  protected readonly districtId = signal<string | null>(null);
  protected readonly churchId = signal<string | null>(null);
  protected readonly groupBy = signal<string | null>(null);
  protected readonly differenceStatus = signal<string | null>(null);
  protected readonly changeType = signal<string | null>(null);
  protected readonly dateFrom = signal<string | null>(null);
  protected readonly dateTo = signal<string | null>(null);

  protected readonly periods = signal<Period[]>([]);
  protected readonly loading = signal(false);
  protected readonly downloading = signal<'excel' | 'txt' | null>(null);
  protected readonly previewUrl = signal<SafeResourceUrl | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

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
    this.groupBy.set(value);
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
    ...this.lookups.districtOptions(this.regionId() || null),
  ]);

  /** Iglesias y Grupos (las filiales van dentro del arqueo de su madre) del distrito o la región elegidos. */
  protected readonly churchOptions = computed<SelectOption[]>(() => {
    const districtIds = new Set(this.lookups.districtOptions(this.regionId() || null).map((d) => d.value));
    return [
      { value: '', label: this.languageService.t(this.definition()?.needsChurch ? 'reports.filters.pickChurch' : 'reports.filters.allChurches') },
      ...this.lookups
        .churches()
        .filter((c) => c.type !== 'Filial' && (this.districtId() ? String(c.districtId) === this.districtId() : districtIds.has(String(c.districtId))))
        .map((c) => ({ value: String(c.churchId), label: `${c.code} ${c.name}` })),
    ];
  });

  /** Un Pastor ya está limitado a su distrito por el backend: no necesita elegirlo. */
  /** Reporte individual sin iglesia elegida todavía. */
  protected readonly missingChurch = computed(() => !!this.definition()?.needsChurch && !this.churchId());

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
      // Abiertos y cerrados, pero no los meses que todavía no empiezan.
      .then((periods) => this.periods.set(periods.filter((p) => isStartedPeriod(p)).sort((a, b) => b.year - a.year || b.month - a.month)))
      .catch(() => this.periods.set([]));

    inject(DestroyRef).onDestroy(() => {
      this.revokePreview();
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
    });

    // Al cambiar de reporte, todos los filtros vuelven a quedar vacíos.
    effect(() => {
      this.definition();
      untracked(() => this.clearFilters());
    });

    // Con los filtros obligatorios completos se genera la vista previa; si falta alguno, se quita.
    effect(() => {
      const query = this.query();
      untracked(() => {
        if (query) {
          this.scheduleGenerate();
        } else {
          if (this.debounceTimer) clearTimeout(this.debounceTimer);
          this.revokePreview();
          this.errorMessage.set(null);
        }
      });
    });
  }

  /** Filtros del reporte con los nombres de su QueryFilter en el backend. */
  protected readonly query = computed<QueryParams | null>(() => {
    const definition = this.definition();
    if (!definition || this.missingFilters().length) return null;
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
          params['periodId'] = this.periodId();
          break;
        case 'region':
          if (this.showRegion()) params['regionId'] = this.regionId() || null;
          break;
        case 'groupBy':
          params['groupBy'] = this.groupBy();
          break;
        case 'district':
          params['districtId'] = this.districtId() || null;
          break;
        case 'church':
          params['churchId'] = this.churchId() || null;
          break;
        case 'differenceStatus':
          params['status'] = this.differenceStatus() || null;
          break;
        case 'changeType':
          params['changeType'] = this.changeType() || null;
          break;
        case 'dateRange':
          params['dateFrom'] = this.dateFrom();
          params['dateTo'] = this.dateTo();
          break;
        case 'periodRange':
          params['fromPeriodId'] = this.periodFrom();
          params['toPeriodId'] = this.periodTo();
          break;
      }
    }
    return this.missingDistrict() || this.missingChurch() ? null : params;
  });

  /** Filtros obligatorios que todavía están vacíos (sus etiquetas, para el aviso). */
  protected readonly missingFilters = computed<string[]>(() => {
    const t = (key: string) => this.languageService.t(key);
    const missing: string[] = [];
    for (const filter of this.definition()?.filters ?? []) {
      switch (filter) {
        case 'year':
          if (!this.year()) missing.push(t('reports.filters.year'));
          break;
        case 'monthRange':
          if (!this.monthFrom()) missing.push(t('reports.filters.monthFrom'));
          if (!this.monthTo()) missing.push(t('reports.filters.monthTo'));
          break;
        case 'period':
          if (!this.periodId()) missing.push(t('funds.filters.period'));
          break;
        case 'groupBy':
          if (!this.groupBy()) missing.push(t('reports.filters.groupBy'));
          break;
        case 'dateRange':
          if (!this.dateFrom()) missing.push(t('reports.filters.dateFrom'));
          if (!this.dateTo()) missing.push(t('reports.filters.dateTo'));
          break;
        case 'periodRange':
          if (!this.periodFrom()) missing.push(t('reports.filters.periodFrom'));
          if (!this.periodTo()) missing.push(t('reports.filters.periodTo'));
          break;
      }
    }
    return missing;
  });

  /** Limpiar: deja todos los filtros vacíos y quita la vista previa. */
  protected clearFilters(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.revokePreview();
    this.errorMessage.set(null);
    for (const filter of [
      this.year, this.monthFrom, this.monthTo, this.periodId, this.periodFrom, this.periodTo, this.regionId,
      this.districtId, this.churchId, this.groupBy, this.differenceStatus, this.changeType, this.dateFrom, this.dateTo,
    ]) {
      filter.set(null);
    }
  }

  protected onRegionChange(value: string | null): void {
    this.regionId.set(value);
    this.districtId.set(null);
    this.churchId.set(null);
  }

  /** Al elegir una iglesia se llenan solos su distrito y, si el reporte la pide, su región. */
  protected onChurchChange(value: string | null): void {
    this.churchId.set(value);
    const church = value ? this.lookups.churches().find((c) => String(c.churchId) === value) : null;
    if (!church) return;
    this.districtId.set(String(church.districtId));
    if (this.showRegion()) {
      const district = this.lookups.districts().find((d) => d.districtId === church.districtId);
      if (district) this.regionId.set(String(district.regionId));
    }
  }

  protected onDistrictChange(value: string | null): void {
    this.districtId.set(value);
    this.churchId.set(null);
  }

  /** Los opcionales guardan '' cuando se elige "Todos", así se ve lo elegido en vez de quedar vacío. */
  protected setOptional(target: { set(value: string | null): void }, value: string | null): void {
    target.set(value);
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

  /** Excel o TXT: se piden al backend con los mismos filtros de la vista previa. */
  protected async download(format: 'excel' | 'txt'): Promise<void> {
    const definition = this.definition();
    const query = this.query();
    if (!definition || !query || this.downloading()) return;
    this.downloading.set(format);
    try {
      const extension = format === 'excel' ? 'xlsx' : 'txt';
      saveBlob(await this.api.download(`/reports/${definition.endpoint}/${format}`, query), `${this.fileName()}.${extension}`);
    } catch (error) {
      this.toastService.show(this.languageService.t(`reports.${format}Error`), (await this.blobErrorMessage(error)) ?? undefined);
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
