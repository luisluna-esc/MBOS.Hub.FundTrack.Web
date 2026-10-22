import { Component, computed, inject, signal } from '@angular/core';
import { ROLES } from '../../../../core/auth/auth.models';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { QueryParams } from '../../../../core/http/api.models';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../../shared/components/filters/filters';
import { SelectOption } from '../../../../shared/components/select/select';
import { Table, TableAction, TableColumn } from '../../../../shared/components/table/table';
import { HeaderButton, ListPage, TableRow } from '../../../../shared/list-page/list-page';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AUDITED_TABLES, AuditLog } from '../../admin.models';
import { AppUserService, AuditLogService } from '../../admin.services';
import { AuditLogDialog, AuditLogDialogData } from '../audit-log-dialog/audit-log-dialog';
import { changedFields } from '../audit-values';

type Row = TableRow<AuditLog>;

// Solo lectura: la llenan los cambios guardados en la base (interceptor del backend) y se purga
// sola pasado el tiempo de retención. La ven M-BOS, Analista y Administrador; el filtro por
// usuario solo aparece para M-BOS, que es el único que puede listar usuarios.
@Component({
  selector: 'app-audit-logs-list',
  imports: [ErrorState, Filters, Table, TranslatePipe],
  templateUrl: '../../../../shared/list-page/list-page.html',
})
export class AuditLogsList extends ListPage<AuditLog> {
  private readonly dialogService = inject(DialogService);
  private readonly auditLogService = inject(AuditLogService);
  private readonly appUserService = inject(AppUserService);

  protected readonly titleKey = 'nav.auditLogs';
  protected override readonly subtitleKey = 'admin.audit.subtitle';

  private readonly userOptions = signal<SelectOption[]>([]);

  constructor() {
    super();
    if (this.authService.roles().includes(ROLES.admin)) {
      this.appUserService
        .all()
        .then((users) => this.userOptions.set(users.map((u) => ({ value: String(u.appUserId), label: u.fullName }))))
        .catch(() => this.userOptions.set([]));
    }
  }

  protected fetchPage(pageNumber: number, pageSize: number, filters: QueryParams) {
    return this.auditLogService.list(pageNumber, pageSize, filters);
  }

  protected toQuery(values: FilterValues): QueryParams {
    const record = values['record']?.trim();
    return {
      appUserId: values['user'],
      tableName: values['table'],
      action: values['action'],
      recordId: record && /^\d+$/.test(record) ? record : undefined,
    };
  }

  protected readonly headerButtons = computed<HeaderButton[]>(() => []);

  protected readonly filterFields = computed<FilterField[]>(() => [
    ...(this.userOptions().length ? [{ key: 'user', label: this.t('admin.columns.user'), type: 'select' as const, options: this.userOptions() }] : []),
    { key: 'table', label: this.t('admin.columns.table'), type: 'select', options: AUDITED_TABLES.map((table) => ({ value: table, label: this.tableLabel(table) })) },
    {
      key: 'action',
      label: this.t('admin.columns.action'),
      type: 'select',
      options: (['INSERT', 'UPDATE', 'DELETE'] as const).map((action) => ({ value: action, label: this.t(`admin.audit.actions.${action}`) })),
    },
    { key: 'record', label: this.t('admin.columns.recordId'), type: 'text' },
  ]);

  protected readonly columns = computed<TableColumn<Row>[]>(() => [
    { key: 'createdAt', header: this.t('admin.columns.date'), format: (v) => new Date(v as string).toLocaleString() },
    { key: 'appUserFullName', header: this.t('admin.columns.user'), format: (v) => (v as string) || this.t('admin.audit.system') },
    { key: 'action', header: this.t('admin.columns.action'), align: 'center', format: (v) => this.t(`admin.audit.actions.${v}`) },
    { key: 'tableName', header: this.t('admin.columns.table'), format: (v) => this.tableLabel(v as string) },
    { key: 'recordId', header: this.t('admin.columns.recordId'), align: 'right', format: (v) => (v === null ? '' : String(v)) },
    {
      key: 'newValue',
      header: this.t('admin.columns.changes'),
      // En UPDATE, los campos que cambiaron; en INSERT y DELETE el registro entero, solo la cantidad.
      format: (_, row) => {
        const fields = changedFields(row).map((f) => f.field);
        if (!fields.length) return '';
        return row.action === 'UPDATE' ? fields.join(', ') : this.t('admin.audit.fieldCount', { count: fields.length });
      },
    },
  ]);

  protected readonly actions = computed<TableAction<Row>[]>(() => [
    { label: this.t('admin.audit.detail'), icon: 'view', onClick: (row) => this.dialogService.open<void, AuditLogDialogData>(AuditLogDialog, { data: { log: row } }) },
  ]);

  private tableLabel(table: string): string {
    const key = `admin.audit.tables.${table}`;
    const label = this.t(key);
    return label === key ? table : label;
  }
}
