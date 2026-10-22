import { Component, computed, inject } from '@angular/core';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { QueryParams } from '../../../../core/http/api.models';
import { ConfirmDialog, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../../shared/components/filters/filters';
import { Table, TableAction, TableColumn } from '../../../../shared/components/table/table';
import { HeaderButton, ListPage, TableRow } from '../../../../shared/list-page/list-page';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CatalogLookups } from '../../catalog-lookups';
import { Pastor } from '../../catalog.models';
import { PastorService } from '../../catalog.services';
import { PastorFormDialog, PastorFormDialogData } from '../pastor-form-dialog/pastor-form-dialog';

type Row = TableRow<Pastor>;

@Component({
  selector: 'app-pastors-list',
  imports: [ErrorState, Filters, Table, TranslatePipe],
  templateUrl: '../../../../shared/list-page/list-page.html',
})
export class PastorsList extends ListPage<Pastor> {
  private readonly dialogService = inject(DialogService);
  private readonly pastorService = inject(PastorService);
  private readonly lookups = inject(CatalogLookups);

  protected readonly titleKey = 'nav.pastors';

  protected fetchPage(pageNumber: number, pageSize: number, filters: QueryParams) {
    return this.pastorService.list(pageNumber, pageSize, filters);
  }

  protected toQuery(values: FilterValues): QueryParams {
    return { searchCriteria: values['search'], isActive: this.bool(values['status']) };
  }

  protected readonly headerButtons = computed<HeaderButton[]>(() =>
    this.authService.canWrite() ? [{ labelKey: 'catalogs.pastors.new', primary: true, onClick: () => this.openForm(null) }] : []
  );

  protected readonly filterFields = computed<FilterField[]>(() => [
    { key: 'search', label: this.t('catalogs.pastors.search'), type: 'text' },
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
    { key: 'fullName', header: this.t('catalogs.columns.fullName') },
    { key: 'ci', header: this.t('catalogs.columns.ci'), format: (v) => (v as string) || this.t('catalogs.pastors.noCi') },
    { key: 'email', header: this.t('catalogs.columns.email'), format: (v) => (v as string) || '' },
    { key: 'currentDistrictName', header: this.t('catalogs.columns.district'), format: (v) => (v as string) || this.t('catalogs.pastors.unassigned') },
    { key: 'isActive', header: this.t('catalogs.columns.status'), align: 'center', format: (v) => this.t(v ? 'catalogs.active' : 'catalogs.inactive') },
  ]);

  protected readonly actions = computed<TableAction<Row>[]>(() =>
    this.authService.canWrite()
      ? [
          { label: this.t('catalogs.actions.edit'), icon: 'edit', onClick: (row) => this.openForm(row) },
          {
            label: this.t('catalogs.actions.delete'),
            icon: 'delete',
            variant: 'danger',
            disabled: (row) => row.currentDistrictId !== null,
            disabledReason: () => this.t('catalogs.pastors.cannotDelete'),
            onClick: (row) => this.confirmDelete(row),
          },
        ]
      : []
  );

  private openForm(pastor: Pastor | null): void {
    this.dialogService.open<boolean, PastorFormDialogData>(PastorFormDialog, { data: { pastor } }).closed.subscribe(this.reloadIfSaved);
  }

  private confirmDelete(row: Pastor): void {
    const ref = this.dialogService.open<boolean, ConfirmDialogData>(ConfirmDialog, {
      data: { title: this.t('catalogs.pastors.deleteTitle'), message: this.t('catalogs.deleteMessage', { name: row.fullName }), confirmLabel: this.t('catalogs.actions.delete') },
    });
    ref.closed.subscribe(async (confirmed) => {
      if (confirmed && (await this.run(() => this.pastorService.delete(row.pastorId), 'common.deleted'))) {
        this.lookups.invalidate('pastors');
      }
    });
  }
}
