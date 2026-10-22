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
import { District } from '../../catalog.models';
import { DistrictService } from '../../catalog.services';
import { AssignPastorDialog, AssignPastorDialogData } from '../assign-pastor-dialog/assign-pastor-dialog';
import { DistrictFormDialog, DistrictFormDialogData } from '../district-form-dialog/district-form-dialog';
import { PastorHistoryDialog, PastorHistoryDialogData } from '../pastor-history-dialog/pastor-history-dialog';

type Row = TableRow<District>;

@Component({
  selector: 'app-districts-list',
  imports: [ErrorState, Filters, Table, TranslatePipe],
  templateUrl: '../../../../shared/list-page/list-page.html',
})
export class DistrictsList extends ListPage<District> {
  private readonly dialogService = inject(DialogService);
  private readonly districtService = inject(DistrictService);
  private readonly lookups = inject(CatalogLookups);

  protected readonly titleKey = 'nav.districts';

  constructor() {
    super();
    void this.lookups.load('regions');
  }

  protected fetchPage(pageNumber: number, pageSize: number, filters: QueryParams) {
    return this.districtService.list(pageNumber, pageSize, filters);
  }

  protected toQuery(values: FilterValues): QueryParams {
    return {
      searchCriteria: values['search'],
      regionId: values['region'],
      isMissionary: this.bool(values['missionary']),
      isActive: this.bool(values['status']),
    };
  }

  protected readonly headerButtons = computed<HeaderButton[]>(() =>
    this.authService.canWrite() ? [{ labelKey: 'catalogs.districts.new', primary: true, onClick: () => this.openForm(null) }] : []
  );

  protected readonly filterFields = computed<FilterField[]>(() => [
    { key: 'search', label: this.t('catalogs.filters.search'), type: 'text' },
    { key: 'region', label: this.t('catalogs.columns.region'), type: 'select', options: this.lookups.regionOptions() },
    {
      key: 'missionary',
      label: this.t('catalogs.columns.missionary'),
      type: 'select',
      options: [
        { value: 'true', label: this.t('catalogs.districts.missionaryOnly') },
        { value: 'false', label: this.t('catalogs.districts.regularOnly') },
      ],
    },
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
    { key: 'regionName', header: this.t('catalogs.columns.region') },
    { key: 'isMissionary', header: this.t('catalogs.columns.missionary'), align: 'center', format: (v) => (v ? this.t('catalogs.districts.dm') : '') },
    { key: 'currentPastorName', header: this.t('catalogs.columns.pastor'), format: (v) => (v as string) || this.t('catalogs.districts.noPastor') },
    { key: 'churchCount', header: this.t('catalogs.columns.churches'), align: 'right' },
    { key: 'isActive', header: this.t('catalogs.columns.status'), align: 'center', format: (v) => this.t(v ? 'catalogs.active' : 'catalogs.inactive') },
  ]);

  protected readonly actions = computed<TableAction<Row>[]>(() => {
    const history: TableAction<Row> = {
      label: this.t('catalogs.districts.pastorHistory'),
      icon: 'view',
      onClick: (row) => this.dialogService.open<void, PastorHistoryDialogData>(PastorHistoryDialog, { data: { district: row } }),
    };
    if (!this.authService.canWrite()) {
      return [history];
    }
    return [
      { label: this.t('catalogs.actions.edit'), icon: 'edit', onClick: (row) => this.openForm(row) },
      {
        label: this.t('catalogs.districts.assignPastor'),
        icon: 'create',
        onClick: (row) => this.dialogService.open<boolean, AssignPastorDialogData>(AssignPastorDialog, { data: { district: row } }).closed.subscribe(this.reloadIfSaved),
      },
      history,
      {
        label: this.t('catalogs.actions.delete'),
        icon: 'delete',
        variant: 'danger',
        disabled: (row) => row.churchCount > 0,
        disabledReason: () => this.t('catalogs.districts.cannotDelete'),
        onClick: (row) => this.confirmDelete(row),
      },
    ];
  });

  private openForm(district: District | null): void {
    this.dialogService.open<boolean, DistrictFormDialogData>(DistrictFormDialog, { data: { district } }).closed.subscribe(this.reloadIfSaved);
  }

  private confirmDelete(row: District): void {
    const ref = this.dialogService.open<boolean, ConfirmDialogData>(ConfirmDialog, {
      data: { title: this.t('catalogs.districts.deleteTitle'), message: this.t('catalogs.deleteMessage', { name: row.name }), confirmLabel: this.t('catalogs.actions.delete') },
    });
    ref.closed.subscribe(async (confirmed) => {
      if (confirmed && (await this.run(() => this.districtService.delete(row.districtId), 'common.deleted'))) {
        this.lookups.invalidate('districts');
      }
    });
  }
}
