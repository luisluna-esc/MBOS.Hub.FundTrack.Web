import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { localDateIso } from '../../../../core/dates/calendar-date';
import { DatePicker } from '../../../../shared/components/date-picker/date-picker';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { FormDialog } from '../../../../shared/list-page/form-dialog';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CatalogLookups } from '../../catalog-lookups';
import { District } from '../../catalog.models';
import { DistrictService } from '../../catalog.services';

export interface AssignPastorDialogData {
  district: District;
}

// Un distrito tiene un solo pastor y un pastor un solo distrito: al asignar uno nuevo, el backend
// cierra la asignación vigente del distrito (y la del pastor) el día anterior a la fecha de inicio.
@Component({
  selector: 'app-assign-pastor-dialog',
  imports: [ReactiveFormsModule, DatePicker, Dialog, Select, TranslatePipe],
  template: `
    <app-dialog
      [title]="'catalogs.districts.assignTitle' | translate: { district: district.name }"
      [saveDisabled]="saveDisabled()"
      [saveLabel]="'catalogs.districts.assignPastor' | translate"
      (save)="save()"
      (cancel)="dialogRef.close(false)"
    >
      <form [formGroup]="form" class="flex flex-col gap-4">
        <div class="rounded-md border border-border bg-surface px-3 py-2 text-sm">
          <span class="text-muted-foreground">{{ 'catalogs.districts.currentPastor' | translate }}:</span>
          <span class="font-medium text-foreground"> {{ district.currentPastorName ?? ('catalogs.districts.noPastor' | translate) }}</span>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <app-select formControlName="pastorId" [label]="'catalogs.columns.pastor' | translate" [options]="pastorOptions()" [required]="true" />
          <app-date-picker formControlName="startDate" [label]="'catalogs.districts.startDate' | translate" [required]="true" />
        </div>
        <p class="text-xs text-muted-foreground">{{ 'catalogs.districts.assignHint' | translate }}</p>
      </form>
    </app-dialog>
  `,
})
export class AssignPastorDialog extends FormDialog {
  protected readonly district = inject<AssignPastorDialogData>(DIALOG_DATA).district;
  protected readonly dialogRef = inject(DialogRef<boolean, AssignPastorDialog>);
  private readonly districtService = inject(DistrictService);
  private readonly lookups = inject(CatalogLookups);

  /** Pastores activos menos el actual; entre paréntesis el distrito que dejarían. */
  protected readonly pastorOptions = computed<SelectOption[]>(() =>
    this.lookups
      .pastors()
      .filter((p) => p.isActive && p.pastorId !== this.district.currentPastorId)
      .map((p) => ({ value: String(p.pastorId), label: p.currentDistrictName ? `${p.fullName} (${p.currentDistrictName})` : p.fullName }))
  );

  protected readonly form = new FormGroup({
    pastorId: new FormControl<string | null>(null, Validators.required),
    startDate: new FormControl<string | null>(localDateIso(), Validators.required),
  });

  constructor() {
    super();
    this.watch(this.form);
    this.lookups.invalidate('pastors');
    void this.lookups.load('pastors');
  }

  protected save(): Promise<void> {
    const raw = this.form.getRawValue();
    return this.submit(async () => {
      await this.districtService.assignPastor(this.district.districtId, { pastorId: Number(raw.pastorId), startDate: raw.startDate! });
      this.lookups.invalidate('pastors', 'districts');
    });
  }
}
