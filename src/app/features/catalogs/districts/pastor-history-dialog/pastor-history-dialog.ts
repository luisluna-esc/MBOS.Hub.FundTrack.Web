import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { formatCalendarDate } from '../../../../core/dates/calendar-date';
import { Badge } from '../../../../shared/components/badge/badge';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { District, DistrictPastor } from '../../catalog.models';
import { DistrictService } from '../../catalog.services';

export interface PastorHistoryDialogData {
  district: District;
}

// Qué pastor tuvo el distrito en cada período: sirve para los reportes de meses pasados.
@Component({
  selector: 'app-pastor-history-dialog',
  imports: [Badge, Dialog, Skeleton, TranslatePipe],
  template: `
    <app-dialog
      [title]="'catalogs.districts.historyTitle' | translate: { district: district.name }"
      [saveDisabled]="false"
      [saveLabel]="'dialog.close' | translate"
      [showCancel]="false"
      (save)="dialogRef.close()"
      (cancel)="dialogRef.close()"
    >
      <div class="flex flex-col gap-2">
        @if (loading()) {
          <app-skeleton height="2.5rem" />
          <app-skeleton height="2.5rem" />
        } @else {
          @for (item of history(); track item.districtPastorId) {
            <div class="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm">
              <span class="font-medium text-foreground">{{ item.pastorName }}</span>
              <span class="flex items-center gap-2 text-muted-foreground">
                {{ date(item.startDate) }} · {{ item.endDate ? date(item.endDate) : ('catalogs.districts.today' | translate) }}
                @if (item.isCurrent) {
                  <app-badge tone="success">{{ 'catalogs.districts.current' | translate }}</app-badge>
                }
              </span>
            </div>
          } @empty {
            <p class="text-sm text-muted-foreground">{{ 'catalogs.districts.noHistory' | translate }}</p>
          }
        }
      </div>
    </app-dialog>
  `,
})
export class PastorHistoryDialog {
  protected readonly district = inject<PastorHistoryDialogData>(DIALOG_DATA).district;
  protected readonly dialogRef = inject(DialogRef<void, PastorHistoryDialog>);
  private readonly districtService = inject(DistrictService);

  protected readonly loading = signal(true);
  protected readonly history = signal<DistrictPastor[]>([]);
  protected readonly date = formatCalendarDate;

  constructor() {
    this.districtService
      .pastorHistory(this.district.districtId)
      .then((history) => this.history.set(history))
      .catch(() => this.history.set([]))
      .finally(() => this.loading.set(false));
  }
}
