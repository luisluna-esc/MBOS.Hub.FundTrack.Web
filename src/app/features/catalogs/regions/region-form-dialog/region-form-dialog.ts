import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Checkbox } from '../../../../shared/components/checkbox/checkbox';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Input as AppInput } from '../../../../shared/components/input/input';
import { FormDialog } from '../../../../shared/list-page/form-dialog';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CatalogLookups } from '../../catalog-lookups';
import { Region } from '../../catalog.models';
import { RegionService } from '../../catalog.services';

export interface RegionFormDialogData {
  region: Region | null;
}

@Component({
  selector: 'app-region-form-dialog',
  imports: [ReactiveFormsModule, Checkbox, Dialog, AppInput, TranslatePipe],
  template: `
    <app-dialog
      [title]="(region ? 'catalogs.regions.editTitle' : 'catalogs.regions.newTitle') | translate"
      [saveDisabled]="saveDisabled()"
      (save)="save()"
      (cancel)="dialogRef.close(false)"
    >
      <form [formGroup]="form" class="flex flex-col gap-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <app-input formControlName="name" [label]="'catalogs.columns.name' | translate" [required]="true" [maxLength]="100" />
          <app-input formControlName="pendingBalance" type="number" [decimals]="2" [label]="'catalogs.columns.pendingBalance' | translate" />
        </div>
        <app-checkbox formControlName="isActive">{{ 'catalogs.active' | translate }}</app-checkbox>
      </form>
    </app-dialog>
  `,
})
export class RegionFormDialog extends FormDialog {
  protected readonly region = inject<RegionFormDialogData>(DIALOG_DATA).region;
  protected readonly dialogRef = inject(DialogRef<boolean, RegionFormDialog>);
  private readonly regionService = inject(RegionService);
  private readonly lookups = inject(CatalogLookups);

  protected readonly form = new FormGroup({
    name: new FormControl(this.region?.name ?? '', { nonNullable: true, validators: Validators.required }),
    pendingBalance: new FormControl<string | null>(this.region ? String(this.region.pendingBalance) : '0'),
    isActive: new FormControl(this.region?.isActive ?? true, { nonNullable: true }),
  });

  constructor() {
    super();
    this.watch(this.form);
  }

  protected save(): Promise<void> {
    const raw = this.form.getRawValue();
    const region: Region = {
      regionId: this.region?.regionId ?? 0,
      name: raw.name.trim(),
      pendingBalance: Number(raw.pendingBalance) || 0,
      isActive: raw.isActive,
    };
    return this.submit(async () => {
      await (this.region ? this.regionService.update(region) : this.regionService.create(region));
      this.lookups.invalidate('regions');
    });
  }
}
