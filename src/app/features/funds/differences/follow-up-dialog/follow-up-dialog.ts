import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Badge } from '../../../../shared/components/badge/badge';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';
import { Textarea } from '../../../../shared/components/textarea/textarea';
import { FormDialog } from '../../../../shared/list-page/form-dialog';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { countStatus, differenceClass } from '../../count-status';
import { DifferenceFollowUp, DifferenceStatus, LocalFundCount } from '../../funds.models';
import { FundsService } from '../../funds.service';

export interface FollowUpDialogData {
  count: LocalFundCount;
  periodLabel: string;
  canWrite: boolean;
}

/** El único paso siguiente permitido (igual que DifferenceStatuses.NextOf del backend): de pendiente a resuelta. */
const NEXT_STATUS: Partial<Record<DifferenceStatus, 'resolved'>> = {
  pending: 'resolved',
};

// Seguimiento de una diferencia: historial y, si está pendiente, marcarla como resuelta con su motivo.
@Component({
  selector: 'app-follow-up-dialog',
  imports: [ReactiveFormsModule, Badge, Dialog, Skeleton, Textarea, MoneyPipe, TranslatePipe],
  templateUrl: './follow-up-dialog.html',
})
export class FollowUpDialog extends FormDialog {
  protected readonly data = inject<FollowUpDialogData>(DIALOG_DATA);
  protected readonly dialogRef = inject(DialogRef<boolean, FollowUpDialog>);
  private readonly fundsService = inject(FundsService);

  protected readonly count = this.data.count;
  protected readonly status = countStatus(this.count);
  /** Solo quien escribe da el siguiente paso; el resto ve el historial. */
  protected readonly nextStatus = this.data.canWrite && this.count.differenceStatus ? (NEXT_STATUS[this.count.differenceStatus] ?? null) : null;

  protected readonly loading = signal(true);
  protected readonly history = signal<DifferenceFollowUp[]>([]);
  protected readonly justification = new FormControl('', { nonNullable: true, validators: Validators.required });

  protected readonly differenceClass = differenceClass;

  constructor() {
    super();
    this.watch(this.justification);
    this.fundsService
      .followUps(this.count.localFundCountId)
      .then((history) => this.history.set(history))
      .catch(() => this.history.set([]))
      .finally(() => this.loading.set(false));
  }

  protected onSave(): Promise<void> | void {
    if (!this.nextStatus) {
      this.dialogRef.close(false);
      return;
    }
    const newStatus = this.nextStatus;
    return this.submit(() => this.fundsService.addFollowUp(this.count.localFundCountId, { newStatus, justification: this.justification.value.trim() }));
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }

  protected dateTime(value: string): string {
    return new Date(value).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  }
}
