import { Component, inject, input, signal } from '@angular/core';
import { ApiService } from '../../../core/http/api.service';
import { saveBlob } from '../../../core/http/save-blob';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../core/toast/toast.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ChartReport, ChartReportFormat } from './chart-report';

export interface LegendItem {
  label: string;
  color: string;
  /** 'line' para series de una gráfica de líneas. */
  shape?: 'box' | 'line';
}

const EXTENSIONS: Record<ChartReportFormat, string> = { pdf: 'pdf', excel: 'xlsx', txt: 'txt' };

// Tarjeta de una gráfica: título, descripción, leyenda (siempre que haya 2 series o más) y los
// botones Reporte y Ver tabla / Ver gráfica. Reporte descarga esa misma gráfica en PDF (con la
// gráfica y su tabla), Excel o TXT, con los filtros elegidos. La tabla es la misma información en
// números, para quien no distingue los colores o necesita el valor exacto. La gráfica va en el
// contenido y la tabla en [table].
@Component({
  selector: 'app-chart-card',
  imports: [TranslatePipe],
  host: { class: 'block min-w-0' },
  template: `
    <section class="flex h-full flex-col gap-3 rounded-lg border border-border bg-chart-surface p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="flex min-w-0 flex-col gap-0.5">
          <h2 class="text-sm font-semibold text-chart-ink">{{ title() }}</h2>
          @if (subtitle()) {
            <p class="text-xs text-chart-ink-muted">{{ subtitle() }}</p>
          }
        </div>
        <div class="flex shrink-0 items-center gap-2">
          @if (report()) {
            <div class="relative">
              <button
                type="button"
                class="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-chart-ink transition-colors hover:bg-background disabled:opacity-60"
                [disabled]="downloading()"
                [attr.aria-expanded]="menuOpen()"
                (click)="menuOpen.set(!menuOpen())"
              >
                {{ (downloading() ? 'reports.downloading' : 'charts.report') | translate }}
              </button>
              @if (menuOpen()) {
                <ul class="absolute right-0 z-20 mt-1 min-w-36 overflow-hidden rounded-md border border-border bg-chart-surface py-1 text-xs shadow-md">
                  @for (format of formats; track format) {
                    <li>
                      <button type="button" class="w-full px-3 py-1.5 text-left text-chart-ink hover:bg-background" (click)="download(format)">
                        {{ 'charts.reportFormats.' + format | translate }}
                      </button>
                    </li>
                  }
                </ul>
              }
            </div>
          }
          <button
            type="button"
            class="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-chart-ink transition-colors hover:bg-background"
            (click)="showTable.set(!showTable())"
          >
            {{ (showTable() ? 'charts.showChart' : 'charts.showTable') | translate }}
          </button>
        </div>
      </div>

      @if (legend().length > 1 && !showTable()) {
        <ul class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-chart-ink-muted">
          @for (item of legend(); track item.label) {
            <li class="flex items-center gap-1.5">
              @if (item.shape === 'line') {
                <span class="h-0.5 w-3.5 rounded-full" [style.background]="item.color"></span>
              } @else {
                <span class="size-2.5 rounded-sm" [style.background]="item.color"></span>
              }
              {{ item.label }}
            </li>
          }
        </ul>
      }

      <div class="min-w-0 flex-1">
        @if (showTable()) {
          <div class="overflow-x-auto"><ng-content select="[table]" /></div>
        } @else {
          <ng-content />
        }
      </div>
    </section>
  `,
})
export class ChartCard {
  private readonly api = inject(ApiService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly legend = input<LegendItem[]>([]);
  /** Los datos para el botón Reporte; sin esto el botón no aparece. */
  readonly report = input<ChartReport | null>(null);

  protected readonly showTable = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly downloading = signal(false);
  protected readonly formats: ChartReportFormat[] = ['pdf', 'excel', 'txt'];

  protected async download(format: ChartReportFormat): Promise<void> {
    const report = this.report();
    this.menuOpen.set(false);
    if (!report || this.downloading()) return;
    this.downloading.set(true);
    try {
      saveBlob(await this.api.downloadPost(`/reports/chart/${format}`, report), `${report.fileName}.${EXTENSIONS[format]}`);
    } catch {
      this.toastService.show(this.languageService.t('charts.reportError'));
    } finally {
      this.downloading.set(false);
    }
  }
}
