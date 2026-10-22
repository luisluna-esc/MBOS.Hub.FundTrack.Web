import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Checkbox } from '../../../../shared/components/checkbox/checkbox';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Input as AppInput } from '../../../../shared/components/input/input';
import { Select } from '../../../../shared/components/select/select';
import { FormDialog } from '../../../../shared/list-page/form-dialog';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CatalogLookups } from '../../catalog-lookups';
import { District, DistrictRequest } from '../../catalog.models';
import { DistrictService } from '../../catalog.services';

export interface DistrictFormDialogData {
  district: District | null;
}

@Component({
  selector: 'app-district-form-dialog',
  imports: [ReactiveFormsModule, Checkbox, Dialog, AppInput, Select, TranslatePipe],
  template: `
    <app-dialog
      [title]="(district ? 'catalogs.districts.editTitle' : 'catalogs.districts.newTitle') | translate"
      [saveDisabled]="saveDisabled()"
      (save)="save()"
      (cancel)="dialogRef.close(false)"
    >
      <form [formGroup]="form" class="flex flex-col gap-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <app-input formControlName="name" [label]="'catalogs.columns.name' | translate" [required]="true" [maxLength]="100" />
          <app-select formControlName="regionId" [label]="'catalogs.columns.region' | translate" [options]="lookups.regionOptions()" [required]="true" />
        </div>
        <app-checkbox formControlName="isMissionary">{{ 'catalogs.districts.isMissionary' | translate }}</app-checkbox>
        <app-checkbox formControlName="isActive">{{ 'catalogs.active' | translate }}</app-checkbox>
      </form>
    </app-dialog>
  `,
})
export class DistrictFormDialog extends FormDialog {
  protected readonly district = inject<DistrictFormDialogData>(DIALOG_DATA).district;
  protected readonly dialogRef = inject(DialogRef<boolean, DistrictFormDialog>);
  private readonly districtService = inject(DistrictService);
  protected readonly lookups = inject(CatalogLookups);

  protected readonly form = new FormGroup({
    name: new FormControl(this.district?.name ?? '', { nonNullable: true, validators: Validators.required }),
    regionId: new FormControl<string | null>(this.district ? String(this.district.regionId) : null, Validators.required),
    isMissionary: new FormControl(this.district?.isMissionary ?? false, { nonNullable: true }),
    isActive: new FormControl(this.district?.isActive ?? true, { nonNullable: true }),
  });

  constructor() {
    super();
    this.watch(this.form);
    void this.lookups.load('regions');
  }

  protected save(): Promise<void> {
    const raw = this.form.getRawValue();
    const request: DistrictRequest = {
      regionId: Number(raw.regionId),
      name: raw.name.trim(),
      isMissionary: raw.isMissionary,
      isActive: raw.isActive,
    };
    return this.submit(async () => {
      await (this.district ? this.districtService.update(this.district.districtId, request) : this.districtService.create(request));
      this.lookups.invalidate('districts');
    });
  }
}
