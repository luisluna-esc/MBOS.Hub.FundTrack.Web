import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { localDateIso } from '../../../../core/dates/calendar-date';
import { DatePicker } from '../../../../shared/components/date-picker/date-picker';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { Textarea } from '../../../../shared/components/textarea/textarea';
import { FormDialog } from '../../../../shared/list-page/form-dialog';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CatalogLookups } from '../../catalog-lookups';
import { Church } from '../../catalog.models';
import { ChurchService } from '../../catalog.services';

export interface ChurchCloseDialogData {
  church: Church;
}

// Cerrar o fusionar deja la iglesia fuera de los arqueos siguientes y lo anota en su historial.
// El backend no deja cerrar una iglesia con filiales activas: primero hay que cerrarlas o moverlas.
@Component({
  selector: 'app-church-close-dialog',
  imports: [ReactiveFormsModule, DatePicker, Dialog, Select, Textarea, TranslatePipe],
  template: `
    <app-dialog
      [title]="'catalogs.churches.closeTitle' | translate: { church: church.name }"
      [saveDisabled]="saveDisabled() || activeFilials() > 0"
      [saveLabel]="(action() === 'merged' ? 'catalogs.churches.merge' : 'catalogs.churches.close') | translate"
      (save)="save()"
      (cancel)="dialogRef.close(false)"
    >
      <form [formGroup]="form" class="flex flex-col gap-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <app-select formControlName="status" [label]="'catalogs.churches.action' | translate" [options]="actionOptions()" [required]="true" />
          @if (action() === 'merged') {
            <app-select formControlName="mergedIntoChurchId" [label]="'catalogs.churches.mergeInto' | translate" [options]="targetOptions()" [required]="true" />
          }
          <app-date-picker formControlName="closedAt" [label]="'catalogs.churches.closedAt' | translate" [required]="true" />
        </div>
        <app-textarea formControlName="reason" [label]="'catalogs.churches.reason' | translate" [required]="true" [maxLength]="500" />
        @if (activeFilials()) {
          <p class="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {{ 'catalogs.churches.closeFilialsBlocked' | translate: { count: activeFilials() } }}
          </p>
        }
      </form>
    </app-dialog>
  `,
})
export class ChurchCloseDialog extends FormDialog {
  protected readonly church = inject<ChurchCloseDialogData>(DIALOG_DATA).church;
  protected readonly dialogRef = inject(DialogRef<boolean, ChurchCloseDialog>);
  private readonly churchService = inject(ChurchService);
  private readonly lookups = inject(CatalogLookups);

  protected readonly form = new FormGroup({
    status: new FormControl<'closed' | 'merged'>('closed', { nonNullable: true }),
    mergedIntoChurchId: new FormControl<string | null>(null),
    closedAt: new FormControl<string | null>(localDateIso(), Validators.required),
    reason: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });

  protected readonly action = signal<'closed' | 'merged'>('closed');

  protected readonly activeFilials = computed(
    () => this.lookups.churches().filter((c) => c.parentChurchId === this.church.churchId && c.status === 'active').length
  );

  protected readonly targetOptions = computed<SelectOption[]>(() =>
    this.lookups
      .churches()
      .filter((c) => c.churchId !== this.church.churchId && c.type !== 'Filial' && c.status === 'active')
      .map((c) => ({ value: String(c.churchId), label: `${c.code} ${c.name} (${c.districtName ?? ''})` }))
  );

  constructor() {
    super();
    this.watch(this.form);
    this.lookups.invalidate('churches');
    void this.lookups.load('churches');

    const { status, mergedIntoChurchId } = this.form.controls;
    status.valueChanges.subscribe((value) => {
      this.action.set(value);
      mergedIntoChurchId.setValidators(value === 'merged' ? Validators.required : null);
      if (value !== 'merged') mergedIntoChurchId.setValue(null);
      mergedIntoChurchId.updateValueAndValidity();
    });
  }

  protected actionOptions() {
    return [
      { value: 'closed', label: this.languageService.t('catalogs.churches.close') },
      { value: 'merged', label: this.languageService.t('catalogs.churches.merge') },
    ];
  }

  protected save(): Promise<void> {
    if (this.activeFilials() > 0) {
      return Promise.resolve();
    }
    const raw = this.form.getRawValue();
    return this.submit(async () => {
      await this.churchService.close(this.church.churchId, {
        status: raw.status,
        closedAt: raw.closedAt!,
        reason: raw.reason.trim(),
        mergedIntoChurchId: raw.status === 'merged' ? Number(raw.mergedIntoChurchId) : null,
      });
      this.lookups.invalidate('churches');
    });
  }
}
