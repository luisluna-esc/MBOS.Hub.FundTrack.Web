import { DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { apiErrorMessage } from '../../../../core/http/api-error';
import { saveBlob } from '../../../../core/http/save-blob';
import { LanguageService } from '../../../../core/i18n/language.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { DatePicker } from '../../../../shared/components/date-picker/date-picker';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CatalogLookups } from '../../catalog-lookups';
import { ImportResult } from '../../catalog.models';
import { ChurchService } from '../../catalog.services';

// Importación del Excel de iglesias (plantilla de /api/imports/churches/template). Siempre en dos
// pasos: primero se revisa el archivo sin guardar nada (dryRun) y se muestra qué crearía; solo si
// no hay errores se puede guardar. Es todo o nada: con un error el backend no guarda ninguna fila.
@Component({
  selector: 'app-church-import-dialog',
  imports: [ReactiveFormsModule, DatePicker, Dialog, TranslatePipe],
  template: `
    <app-dialog
      [title]="'catalogs.import.title' | translate"
      [saveDisabled]="!canSave()"
      [saveLabel]="'catalogs.import.save' | translate"
      size="large"
      (save)="run(false)"
      (cancel)="dialogRef.close(saved())"
    >
      <div class="flex flex-col gap-4 text-sm">
        <p class="text-muted-foreground">{{ 'catalogs.import.hint' | translate }}</p>
        <button type="button" class="self-start text-sm font-medium text-primary underline-offset-2 hover:underline" (click)="downloadTemplate()">
          {{ 'catalogs.import.template' | translate }}
        </button>

        <div class="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
          <label class="flex flex-col gap-1">
            <span class="font-medium text-foreground">{{ 'catalogs.import.file' | translate }}</span>
            <input
              type="file"
              accept=".xlsx"
              class="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-full file:border-0 file:bg-surface file:px-3 file:py-1 file:text-foreground"
              (change)="onFile($event)"
            />
          </label>
          <app-date-picker [formControl]="pastorStartDate" [label]="'catalogs.import.pastorStartDate' | translate" [hint]="'catalogs.import.pastorStartDateHint' | translate" />
        </div>

        <button
          type="button"
          class="self-start rounded-full border border-border px-4 py-2 font-medium text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
          [disabled]="!file() || busy()"
          (click)="run(true)"
        >
          {{ (busy() ? 'common.loading' : 'catalogs.import.review') | translate }}
        </button>

        @if (result(); as r) {
          <div class="flex flex-col gap-3 rounded-md border border-border p-3">
            <p class="font-medium" [class]="r.errors.length ? 'text-danger' : 'text-success'">
              {{ (r.saved ? 'catalogs.import.savedResult' : r.errors.length ? 'catalogs.import.hasErrors' : 'catalogs.import.ready') | translate: { rows: r.totalRows } }}
            </p>
            <dl class="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
              @for (item of counters(r); track item.key) {
                <div class="flex flex-col">
                  <dt class="text-xs text-muted-foreground">{{ 'catalogs.import.counters.' + item.key | translate }}</dt>
                  <dd class="text-base font-semibold text-foreground">{{ item.value }}</dd>
                </div>
              }
            </dl>
            @if (r.errors.length) {
              <ul class="max-h-48 list-inside list-disc overflow-y-auto text-danger">
                @for (issue of r.errors; track $index) {
                  <li>{{ 'catalogs.import.row' | translate: { row: issue.row } }}: {{ issue.message }}</li>
                }
              </ul>
            }
            @if (r.warnings.length) {
              <ul class="max-h-32 list-inside list-disc overflow-y-auto text-warning">
                @for (issue of r.warnings; track $index) {
                  <li>{{ 'catalogs.import.row' | translate: { row: issue.row } }}: {{ issue.message }}</li>
                }
              </ul>
            }
          </div>
        }
      </div>
    </app-dialog>
  `,
})
export class ChurchImportDialog {
  protected readonly dialogRef = inject(DialogRef<boolean, ChurchImportDialog>);
  private readonly churchService = inject(ChurchService);
  private readonly lookups = inject(CatalogLookups);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly file = signal<File | null>(null);
  protected readonly busy = signal(false);
  protected readonly result = signal<ImportResult | null>(null);
  protected readonly saved = signal(false);
  protected readonly pastorStartDate = new FormControl<string | null>(`${new Date().getFullYear()}-01-01`);

  /** Se guarda solo lo que ya se revisó sin errores. */
  protected readonly canSave = computed(() => {
    const result = this.result();
    return !!result && result.dryRun && result.errors.length === 0 && !this.busy();
  });

  protected onFile(event: Event): void {
    this.file.set((event.target as HTMLInputElement).files?.[0] ?? null);
    this.result.set(null);
  }

  protected counters(result: ImportResult): { key: string; value: number }[] {
    return (['regionsCreated', 'districtsCreated', 'pastorsCreated', 'churchesCreated', 'filialsCreated', 'pastorAssignmentsCreated', 'churchesSkipped'] as const).map(
      (key) => ({ key, value: result[key] })
    );
  }

  protected async run(dryRun: boolean): Promise<void> {
    const file = this.file();
    if (!file || this.busy()) return;
    this.busy.set(true);
    try {
      const response = await this.churchService.import(file, dryRun, this.pastorStartDate.value);
      this.result.set(response.data);
      if (!dryRun && response.data.saved) {
        this.saved.set(true);
        this.lookups.invalidate('regions', 'districts', 'pastors', 'churches');
        this.toastService.show(this.languageService.t('common.saved'));
        this.dialogRef.close(true);
      }
    } catch (error) {
      // Con errores en el archivo el backend responde 400 pero igual manda el detalle por fila.
      const data = error instanceof HttpErrorResponse ? (error.error as { data?: ImportResult } | null)?.data : null;
      if (data && Array.isArray(data.errors)) {
        this.result.set(data);
      } else {
        this.toastService.show(this.languageService.t('common.saveError'), apiErrorMessage(error) ?? undefined);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async downloadTemplate(): Promise<void> {
    try {
      saveBlob(await this.churchService.importTemplate(), 'plantilla_iglesias.xlsx');
    } catch (error) {
      this.toastService.show(this.languageService.t('common.loadError'), apiErrorMessage(error) ?? undefined);
    }
  }
}
