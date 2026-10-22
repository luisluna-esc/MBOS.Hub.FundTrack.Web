import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePicker } from '../../../../shared/components/date-picker/date-picker';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { FormDialog } from '../../../../shared/list-page/form-dialog';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Period } from '../../catalog.models';
import { PeriodService } from '../../catalog.services';

export interface PeriodDueDateDialogData {
  period: Period;
}

@Component({
  selector: 'app-period-due-date-dialog',
  imports: [ReactiveFormsModule, DatePicker, Dialog, TranslatePipe],
  template: `
    <app-dialog
      [title]="'catalogs.periods.dueDateTitle' | translate: { period: periodLabel }"
      [saveDisabled]="saveDisabled()"
      (save)="save()"
      (cancel)="dialogRef.close(false)"
    >
      <div class="flex flex-col gap-4">
        <app-date-picker [formControl]="dueDate" [label]="'catalogs.columns.dueDate' | translate" [required]="true" [allowFuture]="true" />
        <p class="text-xs text-muted-foreground">{{ 'catalogs.periods.dueDateHint' | translate }}</p>
      </div>
    </app-dialog>
  `,
})
export class PeriodDueDateDialog extends FormDialog {
  protected readonly period = inject<PeriodDueDateDialogData>(DIALOG_DATA).period;
  protected readonly dialogRef = inject(DialogRef<boolean, PeriodDueDateDialog>);
  private readonly periodService = inject(PeriodService);

  protected readonly periodLabel = `${this.languageService.t(`months.${this.period.month}`)} ${this.period.year}`;
  protected readonly dueDate = new FormControl<string | null>(this.period.dueDate, Validators.required);

  constructor() {
    super();
    this.watch(this.dueDate);
  }

  protected save(): Promise<void> {
    return this.submit(() => this.periodService.updateDueDate(this.period.periodId, this.dueDate.value!));
  }
}
