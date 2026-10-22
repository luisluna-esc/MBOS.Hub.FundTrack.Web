import { DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Input as AppInput } from '../../../../shared/components/input/input';
import { FormDialog } from '../../../../shared/list-page/form-dialog';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PeriodService } from '../../catalog.services';

// Crea solo los meses que falten del año, cada uno con fecha límite el 15 del mes siguiente.
@Component({
  selector: 'app-generate-year-dialog',
  imports: [ReactiveFormsModule, Dialog, AppInput, TranslatePipe],
  template: `
    <app-dialog
      [title]="'catalogs.periods.generateYear' | translate"
      [saveDisabled]="saveDisabled()"
      [saveLabel]="'catalogs.periods.generate' | translate"
      (save)="save()"
      (cancel)="dialogRef.close(false)"
    >
      <div class="flex flex-col gap-4">
        <app-input [formControl]="year" type="number" [label]="'catalogs.columns.year' | translate" [required]="true" [min]="2000" [decimals]="0" />
        <p class="text-xs text-muted-foreground">{{ 'catalogs.periods.generateHint' | translate }}</p>
      </div>
    </app-dialog>
  `,
})
export class GenerateYearDialog extends FormDialog {
  protected readonly dialogRef = inject(DialogRef<boolean, GenerateYearDialog>);
  private readonly periodService = inject(PeriodService);

  protected readonly year = new FormControl<string | null>(String(new Date().getFullYear()), [Validators.required, Validators.min(2000), Validators.max(2100)]);

  constructor() {
    super();
    this.watch(this.year);
  }

  protected save(): Promise<void> {
    return this.submit(() => this.periodService.generateYear(Number(this.year.value)));
  }
}
