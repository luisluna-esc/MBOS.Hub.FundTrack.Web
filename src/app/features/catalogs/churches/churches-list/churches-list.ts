import { Component, computed, inject } from '@angular/core';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { QueryParams } from '../../../../core/http/api.models';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../../shared/components/filters/filters';
import { Table, TableAction, TableColumn } from '../../../../shared/components/table/table';
import { HeaderButton, ListPage, TableRow } from '../../../../shared/list-page/list-page';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CatalogLookups } from '../../catalog-lookups';
import { Church } from '../../catalog.models';
import { ChurchService } from '../../catalog.services';
import { ChurchCloseDialog, ChurchCloseDialogData } from '../church-close-dialog/church-close-dialog';
import { ChurchFormDialog, ChurchFormDialogData } from '../church-form-dialog/church-form-dialog';
import { ChurchHistoryDialog, ChurchHistoryDialogData } from '../church-history-dialog/church-history-dialog';
import { ChurchImportDialog } from '../church-import-dialog/church-import-dialog';

type Row = TableRow<Church>;

@Component({
  selector: 'app-churches-list',
  imports: [ErrorState, Filters, Table, TranslatePipe],
  templateUrl: '../../../../shared/list-page/list-page.html',
})
export class ChurchesList extends ListPage<Church> {
  private readonly dialogService = inject(DialogService);
  private readonly churchService = inject(ChurchService);
  private readonly lookups = inject(CatalogLookups);

  protected readonly titleKey = 'nav.churches';
  protected override readonly subtitleKey = 'catalogs.churches.subtitle';

  constructor() {
    super();
    void this.lookups.load('regions', 'districts');
  }

  protected fetchPage(pageNumber: number, pageSize: number, filters: QueryParams) {
    return this.churchService.list(pageNumber, pageSize, filters);
  }

  protected toQuery(values: FilterValues): QueryParams {
    return {
      searchCriteria: values['search'],
      type: values['type'],
      regionId: values['region'],
      districtId: values['district'],
      status: values['status'],
    };
  }

  protected readonly headerButtons = computed<HeaderButton[]>(() =>
    this.authService.canWrite()
      ? [
          { labelKey: 'catalogs.churches.import', onClick: () => this.openImport() },
          { labelKey: 'catalogs.churches.new', primary: true, onClick: () => this.openForm(null) },
        ]
      : []
  );

  protected readonly filterFields = computed<FilterField[]>(() => [
    { key: 'search', label: this.t('catalogs.churches.search'), type: 'text' },
    { key: 'type', label: this.t('catalogs.columns.type'), type: 'select', options: this.typeOptions() },
    { key: 'region', label: this.t('catalogs.columns.region'), type: 'select', options: this.lookups.regionOptions() },
    { key: 'district', label: this.t('catalogs.columns.district'), type: 'select', options: this.lookups.districtOptions() },
    { key: 'status', label: this.t('catalogs.filters.status'), type: 'select', options: this.statusOptions() },
  ]);

  protected readonly columns = computed<TableColumn<Row>[]>(() => [
    { key: 'code', header: this.t('catalogs.columns.code') },
    { key: 'name', header: this.t('catalogs.columns.name') },
    {
      key: 'type',
      header: this.t('catalogs.columns.type'),
      format: (v, row) => {
        const type = this.t(`catalogs.churches.types.${v}`);
        if (row.type === 'Filial') return `${type} (${row.parentChurchName ?? ''})`;
        return row.filialCount ? `${type} · ${this.t('catalogs.churches.filialCount', { count: row.filialCount })}` : type;
      },
    },
    { key: 'districtName', header: this.t('catalogs.columns.district') },
    { key: 'regionName', header: this.t('catalogs.columns.region') },
    { key: 'currentPastorName', header: this.t('catalogs.columns.pastor'), format: (v) => (v as string) || this.t('catalogs.districts.noPastor') },
    {
      key: 'status',
      header: this.t('catalogs.columns.status'),
      align: 'center',
      format: (v) => this.t(`catalogs.churches.statuses.${v}`),
      tooltip: (_, row) => (row.mergedIntoChurchName ? this.t('catalogs.churches.mergedInto', { church: row.mergedIntoChurchName }) : null),
    },
  ]);

  protected readonly actions = computed<TableAction<Row>[]>(() => {
    const history: TableAction<Row> = {
      label: this.t('catalogs.churches.history'),
      icon: 'view',
      onClick: (row) => this.dialogService.open<void, ChurchHistoryDialogData>(ChurchHistoryDialog, { data: { church: row } }),
    };
    if (!this.authService.canWrite()) {
      return [history];
    }
    return [
      {
        label: this.t('catalogs.actions.edit'),
        icon: 'edit',
        disabled: (row) => row.status !== 'active',
        disabledReason: () => this.t('catalogs.churches.alreadyClosed'),
        onClick: (row) => this.openForm(row),
      },
      history,
      {
        label: this.t('catalogs.churches.closeOrMerge'),
        icon: 'void',
        variant: 'danger',
        disabled: (row) => row.status !== 'active',
        disabledReason: () => this.t('catalogs.churches.alreadyClosed'),
        onClick: (row) => this.dialogService.open<boolean, ChurchCloseDialogData>(ChurchCloseDialog, { data: { church: row } }).closed.subscribe(this.reloadIfSaved),
      },
    ];
  });

  private typeOptions() {
    return (['Iglesia', 'Grupo', 'Filial'] as const).map((type) => ({ value: type, label: this.t(`catalogs.churches.types.${type}`) }));
  }

  private statusOptions() {
    return (['active', 'closed', 'merged'] as const).map((status) => ({ value: status, label: this.t(`catalogs.churches.statuses.${status}`) }));
  }

  private openForm(church: Church | null): void {
    this.dialogService.open<boolean, ChurchFormDialogData>(ChurchFormDialog, { data: { church } }).closed.subscribe(this.reloadIfSaved);
  }

  private openImport(): void {
    this.dialogService.open<boolean>(ChurchImportDialog).closed.subscribe(this.reloadIfSaved);
  }
}
