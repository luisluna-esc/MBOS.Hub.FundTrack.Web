import { Component, computed, inject } from '@angular/core';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { QueryParams } from '../../../../core/http/api.models';
import { ConfirmDialog, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../../shared/components/filters/filters';
import { Table, TableAction, TableColumn } from '../../../../shared/components/table/table';
import { HeaderButton, ListPage, TableRow } from '../../../../shared/list-page/list-page';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CatalogLookups } from '../../../catalogs/catalog-lookups';
import { AppUser } from '../../admin.models';
import { AppUserService } from '../../admin.services';
import { UserFormDialog, UserFormDialogData } from '../user-form-dialog/user-form-dialog';
import { UserRolesDialog, UserRolesDialogData } from '../user-roles-dialog/user-roles-dialog';

type Row = TableRow<AppUser>;

@Component({
  selector: 'app-users-list',
  imports: [ErrorState, Filters, Table, TranslatePipe],
  templateUrl: '../../../../shared/list-page/list-page.html',
})
export class UsersList extends ListPage<AppUser> {
  private readonly dialogService = inject(DialogService);
  private readonly appUserService = inject(AppUserService);
  private readonly lookups = inject(CatalogLookups);

  protected readonly titleKey = 'nav.users';

  constructor() {
    super();
    void this.lookups.load('pastors');
  }

  protected fetchPage(pageNumber: number, pageSize: number, filters: QueryParams) {
    return this.appUserService.list(pageNumber, pageSize, filters);
  }

  protected toQuery(values: FilterValues): QueryParams {
    return { searchCriteria: values['search'], isActive: this.bool(values['status']) };
  }

  protected readonly headerButtons = computed<HeaderButton[]>(() => [{ labelKey: 'admin.users.new', primary: true, onClick: () => this.openForm(null) }]);

  protected readonly filterFields = computed<FilterField[]>(() => [
    { key: 'search', label: this.t('admin.users.search'), type: 'text' },
    {
      key: 'status',
      label: this.t('catalogs.filters.status'),
      type: 'select',
      options: [
        { value: 'true', label: this.t('catalogs.active') },
        { value: 'false', label: this.t('catalogs.inactive') },
      ],
    },
  ]);

  private readonly pastorNames = computed(() => new Map(this.lookups.pastors().map((p) => [p.pastorId, p.fullName])));

  protected readonly columns = computed<TableColumn<Row>[]>(() => [
    { key: 'fullName', header: this.t('catalogs.columns.fullName') },
    { key: 'username', header: this.t('admin.users.username') },
    { key: 'pastorId', header: this.t('admin.users.linkedPastor'), format: (v) => (v ? (this.pastorNames().get(v as number) ?? '') : '') },
    {
      key: 'lastLogin',
      header: this.t('admin.columns.lastLogin'),
      format: (v) => (v ? new Date(v as string).toLocaleString() : this.t('admin.users.never')),
    },
    { key: 'isActive', header: this.t('catalogs.columns.status'), align: 'center', format: (_, row) => this.t(`admin.users.states.${this.state(row)}`) },
  ]);

  protected readonly actions = computed<TableAction<Row>[]>(() => [
    { label: this.t('catalogs.actions.edit'), icon: 'edit', onClick: (row) => this.openForm(row) },
    {
      label: this.t('admin.users.roles'),
      icon: 'verified',
      onClick: (row) => this.dialogService.open<boolean, UserRolesDialogData>(UserRolesDialog, { data: { user: row } }),
    },
    {
      label: this.t('catalogs.actions.delete'),
      icon: 'delete',
      variant: 'danger',
      disabled: (row) => row.appUserId === this.authService.session()?.appUserId,
      disabledReason: () => this.t('admin.users.cannotDeleteSelf'),
      onClick: (row) => this.confirmDelete(row),
    },
  ]);

  /** Bloqueado = superó los intentos fallidos y el bloqueo sigue vigente. */
  private state(row: AppUser): 'active' | 'locked' | 'inactive' {
    if (!row.isActive) return 'inactive';
    return row.lockedUntil && new Date(row.lockedUntil) > new Date() ? 'locked' : 'active';
  }

  private openForm(user: AppUser | null): void {
    this.dialogService.open<boolean, UserFormDialogData>(UserFormDialog, { data: { user } }).closed.subscribe(this.reloadIfSaved);
  }

  private confirmDelete(row: AppUser): void {
    const ref = this.dialogService.open<boolean, ConfirmDialogData>(ConfirmDialog, {
      data: { title: this.t('admin.users.deleteTitle'), message: this.t('admin.users.deleteMessage', { name: row.fullName }), confirmLabel: this.t('catalogs.actions.delete') },
    });
    ref.closed.subscribe((confirmed) => confirmed && void this.run(() => this.appUserService.delete(row.appUserId), 'common.deleted'));
  }
}
