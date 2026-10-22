import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Checkbox } from '../../../../shared/components/checkbox/checkbox';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Input as AppInput } from '../../../../shared/components/input/input';
import { FormDialog } from '../../../../shared/list-page/form-dialog';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CatalogLookups } from '../../catalog-lookups';
import { Pastor, PastorRequest } from '../../catalog.models';
import { PastorService } from '../../catalog.services';

export interface PastorFormDialogData {
  pastor: Pastor | null;
}

// El distrito no se elige aquí: se asigna desde Distritos, para que quede en el historial.
@Component({
  selector: 'app-pastor-form-dialog',
  imports: [ReactiveFormsModule, Checkbox, Dialog, AppInput, TranslatePipe],
  template: `
    <app-dialog
      [title]="(pastor ? 'catalogs.pastors.editTitle' : 'catalogs.pastors.newTitle') | translate"
      [saveDisabled]="saveDisabled()"
      (save)="save()"
      (cancel)="dialogRef.close(false)"
    >
      <form [formGroup]="form" class="flex flex-col gap-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <app-input formControlName="lastNames" [label]="'catalogs.columns.lastNames' | translate" [required]="true" [maxLength]="100" />
          <app-input formControlName="firstNames" [label]="'catalogs.columns.firstNames' | translate" [required]="true" [maxLength]="100" />
          <app-input formControlName="ci" [label]="'catalogs.columns.ci' | translate" [hint]="'catalogs.pastors.ciHint' | translate" [maxLength]="20" />
          <app-input formControlName="email" type="email" [label]="'catalogs.columns.email' | translate" [maxLength]="150" />
        </div>
        @if (pastor) {
          <div class="rounded-md border border-border bg-surface px-3 py-2 text-sm">
            <span class="text-muted-foreground">{{ 'catalogs.columns.district' | translate }}:</span>
            <span class="font-medium text-foreground"> {{ pastor.currentDistrictName ?? ('catalogs.pastors.unassigned' | translate) }}</span>
            <p class="mt-1 text-xs text-muted-foreground">{{ 'catalogs.pastors.districtHint' | translate }}</p>
          </div>
        }
        <app-checkbox formControlName="isActive">{{ 'catalogs.active' | translate }}</app-checkbox>
      </form>
    </app-dialog>
  `,
})
export class PastorFormDialog extends FormDialog {
  protected readonly pastor = inject<PastorFormDialogData>(DIALOG_DATA).pastor;
  protected readonly dialogRef = inject(DialogRef<boolean, PastorFormDialog>);
  private readonly pastorService = inject(PastorService);
  private readonly lookups = inject(CatalogLookups);

  protected readonly form = new FormGroup({
    lastNames: new FormControl(this.pastor?.lastNames ?? '', { nonNullable: true, validators: Validators.required }),
    firstNames: new FormControl(this.pastor?.firstNames ?? '', { nonNullable: true, validators: Validators.required }),
    ci: new FormControl(this.pastor?.ci ?? ''),
    email: new FormControl(this.pastor?.email ?? '', Validators.email),
    isActive: new FormControl(this.pastor?.isActive ?? true, { nonNullable: true }),
  });

  constructor() {
    super();
    this.watch(this.form);
  }

  protected save(): Promise<void> {
    const raw = this.form.getRawValue();
    const request: PastorRequest = {
      ci: this.text(raw.ci),
      firstNames: raw.firstNames.trim(),
      lastNames: raw.lastNames.trim(),
      email: this.text(raw.email),
      isActive: raw.isActive,
    };
    return this.submit(async () => {
      await (this.pastor ? this.pastorService.update(this.pastor.pastorId, request) : this.pastorService.create(request));
      this.lookups.invalidate('pastors');
    });
  }
}
