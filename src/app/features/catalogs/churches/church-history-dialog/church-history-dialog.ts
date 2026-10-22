import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { formatCalendarDate } from '../../../../core/dates/calendar-date';
import { LanguageService } from '../../../../core/i18n/language.service';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Church, ChurchHistory } from '../../catalog.models';
import { ChurchService } from '../../catalog.services';

export interface ChurchHistoryDialogData {
  church: Church;
}

// Cambios de tipo, distrito, estado o nombre de la iglesia, con quién los hizo y por qué.
@Component({
  selector: 'app-church-history-dialog',
  imports: [Dialog, Skeleton, TranslatePipe],
  template: `
    <app-dialog
      [title]="'catalogs.churches.historyTitle' | translate: { church: church.name }"
      [saveDisabled]="false"
      [saveLabel]="'dialog.close' | translate"
      [showCancel]="false"
      (save)="dialogRef.close()"
      (cancel)="dialogRef.close()"
    >
      <div class="flex flex-col gap-2">
        @if (loading()) {
          <app-skeleton height="3.5rem" />
          <app-skeleton height="3.5rem" />
        } @else {
          @for (item of history(); track item.churchHistoryId) {
            <div class="flex flex-col gap-1 rounded-md border border-border bg-surface px-3 py-2 text-sm">
              <div class="flex items-center justify-between gap-3">
                <span class="font-medium text-foreground">{{ 'catalogs.churches.changeTypes.' + item.changeType | translate }}</span>
                <span class="text-xs text-muted-foreground">{{ date(item.changedAt) }} · {{ item.appUserFullName ?? '' }}</span>
              </div>
              <span class="text-foreground">
                {{ 'catalogs.churches.changeValues' | translate: { old: value(item.changeType, item.oldValue), new: value(item.changeType, item.newValue) } }}
              </span>
              @if (item.reason) {
                <span class="text-muted-foreground">{{ item.reason }}</span>
              }
            </div>
          } @empty {
            <p class="text-sm text-muted-foreground">{{ 'catalogs.churches.noHistory' | translate }}</p>
          }
        }
      </div>
    </app-dialog>
  `,
})
export class ChurchHistoryDialog {
  protected readonly church = inject<ChurchHistoryDialogData>(DIALOG_DATA).church;
  protected readonly dialogRef = inject(DialogRef<void, ChurchHistoryDialog>);
  private readonly churchService = inject(ChurchService);

  protected readonly loading = signal(true);
  protected readonly history = signal<ChurchHistory[]>([]);
  protected readonly date = formatCalendarDate;

  private readonly languageService = inject(LanguageService);

  constructor() {
    this.churchService
      .history(this.church.churchId)
      .then((history) => this.history.set(history))
      .catch(() => this.history.set([]))
      .finally(() => this.loading.set(false));
  }

  /** Los estados se guardan en inglés ("closed"); el resto (tipo, nombre, distrito) tal cual. */
  protected value(changeType: string, value: string | null): string {
    if (!value) return '';
    return changeType === 'status' ? this.languageService.t(`catalogs.churches.statuses.${value}`) : value;
  }
}
