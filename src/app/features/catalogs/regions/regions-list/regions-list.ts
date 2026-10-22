import { Component, computed, inject } from '@angular/core';
import { QueryParams } from '../../../../core/http/api.models';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { ConfirmDialog, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../../shared/components/filters/filters';
import { Table, TableAction, TableColumn } from '../../../../shared/components/table/table';
import { HeaderButton, ListPage, TableRow } from '../../../../shared/list-page/list-page';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Region } from '../../catalog.models';
import { RegionService } from '../../catalog.services';
import { RegionFormDialog, RegionFormDialogData } from '../region-form-dialog/region-form-dialog';

type Row = TableRow<Region>;

const money = new MoneyPipe();

@Component({
  selector: 'app-regions-list',
  imports: [ErrorState, Filters, Table, TranslatePipe],
  templateUrl: '../../../../shared/list-page/list-page.html',
})
export class RegionsList extends ListPage<Region> {
  private readonly dialogService = inject(DialogService);
  private readonly regionService = inject(RegionService);

  protected readonly titleKey = 'nav.regions';

  protected fetchPage(pageNumber: number, pageSize: number, filters: QueryParams) {
    return this.regionService.list(pageNumber, pageSize, filters);
  }

  protected toQuery(values: FilterValues): QueryParams {
    return { searchCriteria: values['search'], isActive: this.bool(values['status']) };
  }

  protected readonly headerButtons = computed<HeaderButton[]>(() =>
    this.authService.canWrite() ? [{ labelKey: 'catalogs.regions.new', primary: true, onClick: () => this.openForm(null) }] : []
  );

  protected readonly filterFields = computed<FilterField[]>(() => [
    { key: 'search', label: this.t('catalogs.filters.search'), type: 'text' },
    { key: 'status', label: this.t('catalogs.filters.status'), type: 'select', options: this.statusOptions() },
  ]);

  protected readonly columns = computed<TableColumn<Row>[]>(() => [
    { key: 'name', header: this.t('catalogs.columns.name') },
    { key: 'pendingBalance', header: this.t('catalogs.columns.pendingBalance'), align: 'right', format: (v) => money.transform(v as number) },
    { key: 'isActive', header: this.t('catalogs.columns.status'), align: 'center', format: (v) => this.t(v ? 'catalogs.active' : 'catalogs.inactive') },
  ]);

  protected readonly actions = computed<TableAction<Row>[]>(() =>
    this.authService.canWrite()
      ? [
          { label: this.t('catalogs.actions.edit'), icon: 'edit', onClick: (row) => this.openForm(row) },
          { label: this.t('catalogs.actions.delete'), icon: 'delete', variant: 'danger', onClick: (row) => this.confirmDelete(row) },
        ]
      : []
  );

  protected statusOptions() {
    return [
      { value: 'true', label: this.t('catalogs.active') },
      { value: 'false', label: this.t('catalogs.inactive') },
    ];
  }

  private openForm(region: Region | null): void {
    this.dialogService.open<boolean, RegionFormDialogData>(RegionFormDialog, { data: { region } }).closed.subscribe(this.reloadIfSaved);
  }

  // El backend no deja eliminar una región con distritos y explica por qué en el mensaje.
  private confirmDelete(row: Region): void {
    const ref = this.dialogService.open<boolean, ConfirmDialogData>(ConfirmDialog, {
      data: { title: this.t('catalogs.regions.deleteTitle'), message: this.t('catalogs.deleteMessage', { name: row.name }), confirmLabel: this.t('catalogs.actions.delete') },
    });
    ref.closed.subscribe((confirmed) => confirmed && void this.run(() => this.regionService.delete(row.regionId), 'common.deleted'));
  }
}
