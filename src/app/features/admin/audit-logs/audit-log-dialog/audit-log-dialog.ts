import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { LanguageService } from '../../../../core/i18n/language.service';
import { Badge, BadgeTone } from '../../../../shared/components/badge/badge';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AuditAction, AuditLog } from '../../admin.models';
import { changedFields } from '../audit-values';

export interface AuditLogDialogData {
  log: AuditLog;
}

const ACTION_TONES: Record<AuditAction, BadgeTone> = { INSERT: 'success', UPDATE: 'info', DELETE: 'danger' };

@Component({
  selector: 'app-audit-log-dialog',
  imports: [Badge, Dialog, TranslatePipe],
  template: `
    <app-dialog
      [title]="'admin.audit.detailTitle' | translate: { id: log.auditLogId }"
      [saveDisabled]="false"
      [saveLabel]="'dialog.close' | translate"
      [showCancel]="false"
      size="large"
      (save)="dialogRef.close()"
      (cancel)="dialogRef.close()"
    >
      <div class="flex flex-col gap-4 text-sm">
        <dl class="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <div class="flex gap-2">
            <dt class="text-muted-foreground">{{ 'admin.columns.action' | translate }}:</dt>
            <dd><app-badge [tone]="tone">{{ 'admin.audit.actions.' + log.action | translate }}</app-badge></dd>
          </div>
          <div class="flex gap-2">
            <dt class="text-muted-foreground">{{ 'admin.columns.date' | translate }}:</dt>
            <dd class="text-foreground">{{ date }}</dd>
          </div>
          <div class="flex gap-2">
            <dt class="text-muted-foreground">{{ 'admin.columns.user' | translate }}:</dt>
            <dd class="text-foreground">{{ log.appUserFullName ?? ('admin.audit.system' | translate) }}</dd>
          </div>
          <div class="flex gap-2">
            <dt class="text-muted-foreground">{{ 'admin.columns.table' | translate }}:</dt>
            <dd class="text-foreground">{{ tableLabel }}@if (log.recordId !== null) { #{{ log.recordId }} }</dd>
          </div>
          <div class="flex gap-2">
            <dt class="text-muted-foreground">IP:</dt>
            <dd class="text-foreground">{{ log.ip ?? '' }}</dd>
          </div>
          <div class="flex min-w-0 gap-2">
            <dt class="text-muted-foreground">{{ 'admin.audit.browser' | translate }}:</dt>
            <dd class="truncate text-foreground" [title]="log.userAgent ?? ''">{{ log.userAgent ?? '' }}</dd>
          </div>
        </dl>

        <div class="overflow-x-auto rounded-md border border-border">
          <table class="w-full text-left text-sm">
            <thead class="bg-surface text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 font-medium">{{ 'admin.audit.field' | translate }}</th>
                <th class="px-3 py-2 font-medium">{{ 'admin.audit.before' | translate }}</th>
                <th class="px-3 py-2 font-medium">{{ 'admin.audit.after' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (change of changes; track change.field) {
                <tr class="border-t border-border">
                  <td class="px-3 py-2 font-medium text-foreground">{{ change.field }}</td>
                  <td class="px-3 py-2 break-all text-danger">{{ change.before ?? '' }}</td>
                  <td class="px-3 py-2 break-all text-success">{{ change.after ?? '' }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3" class="px-3 py-4 text-center text-muted-foreground">{{ 'admin.audit.noChanges' | translate }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="text-xs text-muted-foreground">{{ 'admin.audit.maskedHint' | translate }}</p>
      </div>
    </app-dialog>
  `,
})
export class AuditLogDialog {
  protected readonly log = inject<AuditLogDialogData>(DIALOG_DATA).log;
  protected readonly dialogRef = inject(DialogRef<void, AuditLogDialog>);
  private readonly languageService = inject(LanguageService);

  protected readonly tone = ACTION_TONES[this.log.action];
  protected readonly changes = changedFields(this.log);
  protected readonly date = new Date(this.log.createdAt).toLocaleString();
  protected readonly tableLabel = (() => {
    const key = `admin.audit.tables.${this.log.tableName}`;
    const label = this.languageService.t(key);
    return label === key ? this.log.tableName : label;
  })();
}
