import { Component, computed, inject } from '@angular/core';
import { ROLES } from '../../../../core/auth/auth.models';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { QueryParams } from '../../../../core/http/api.models';
import { ConfirmDialog, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../../shared/components/filters/filters';
import { Table, TableAction, TableColumn } from '../../../../shared/components/table/table';
import { HeaderButton, ListPage, TableRow } from '../../../../shared/list-page/list-page';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Role } from '../../admin.models';
import { RoleService } from '../../admin.services';
import { RoleFormDialog, RoleFormDialogData } from '../role-form-dialog/role-form-dialog';
import { RoleMenusDialog, RoleMenusDialogData } from '../role-menus-dialog/role-menus-dialog';

type Row = TableRow<Role>;

// Los permisos no se configuran aquí: quién escribe y quién solo consulta está fijo en el backend
// por nombre de rol. Aquí solo se decide qué menús ve cada rol.
@Component({
  selector: 'app-roles-list',
  imports: [ErrorState, Filters, Table, TranslatePipe],
  templateUrl: '../../../../shared/list-page/list-page.html',
})
export class RolesList extends ListPage<Role> {
  private readonly dialogService = inject(DialogService);
  private readonly roleService = inject(RoleService);

  protected readonly titleKey = 'nav.roles';
  protected override readonly subtitleKey = 'admin.roles.subtitle';

  protected fetchPage(pageNumber: number, pageSize: number, filters: QueryParams) {
    return this.roleService.list(pageNumber, pageSize, filters);
  }

  protected toQuery(values: FilterValues): QueryParams {
    return { searchCriteria: values['search'], isActive: this.bool(values['status']) };
  }

  protected readonly headerButtons = computed<HeaderButton[]>(() => [{ labelKey: 'admin.roles.new', primary: true, onClick: () => this.openForm(null) }]);

  protected readonly filterFields = computed<FilterField[]>(() => [
    { key: 'search', label: this.t('catalogs.filters.search'), type: 'text' },
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

  protected readonly columns = computed<TableColumn<Row>[]>(() => [
    { key: 'name', header: this.t('catalogs.columns.name') },
    { key: 'description', header: this.t('admin.columns.description'), format: (v) => (v as string) || '' },
    { key: 'isActive', header: this.t('catalogs.columns.status'), align: 'center', format: (v) => this.t(v ? 'catalogs.active' : 'catalogs.inactive') },
  ]);

  protected readonly actions = computed<TableAction<Row>[]>(() => [
    {
      label: this.t('catalogs.actions.edit'),
      icon: 'edit',
      disabled: (row) => row.name === ROLES.admin,
      disabledReason: () => this.t('admin.roles.protected'),
      onClick: (row) => this.openForm(row),
    },
    {
      label: this.t('admin.roles.menus'),
      icon: 'menu',
      onClick: (row) => this.dialogService.open<boolean, RoleMenusDialogData>(RoleMenusDialog, { data: { role: row } }),
    },
    {
      label: this.t('catalogs.actions.delete'),
      icon: 'delete',
      variant: 'danger',
      disabled: (row) => row.name === ROLES.admin,
      disabledReason: () => this.t('admin.roles.protected'),
      onClick: (row) => this.confirmDelete(row),
    },
  ]);

  private openForm(role: Role | null): void {
    this.dialogService.open<boolean, RoleFormDialogData>(RoleFormDialog, { data: { role } }).closed.subscribe(this.reloadIfSaved);
  }

  // La base quita el rol a sus usuarios en cascada (app_user_role ON DELETE CASCADE): se avisa.
  private confirmDelete(row: Role): void {
    const ref = this.dialogService.open<boolean, ConfirmDialogData>(ConfirmDialog, {
      data: { title: this.t('admin.roles.deleteTitle'), message: this.t('admin.roles.deleteMessage', { name: row.name }), confirmLabel: this.t('catalogs.actions.delete') },
    });
    ref.closed.subscribe((confirmed) => confirmed && void this.run(() => this.roleService.delete(row.roleId), 'common.deleted'));
  }
}
