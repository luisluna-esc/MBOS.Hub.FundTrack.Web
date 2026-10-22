import { Component, computed, inject } from '@angular/core';
import { formatCalendarDate, localDateIso } from '../../../../core/dates/calendar-date';
import { DialogService } from '../../../../core/dialog/dialog.service';
import { QueryParams } from '../../../../core/http/api.models';
import { ConfirmDialog, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../../shared/components/filters/filters';
import { Table, TableAction, TableColumn } from '../../../../shared/components/table/table';
import { HeaderButton, ListPage, TableRow } from '../../../../shared/list-page/list-page';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Period } from '../../catalog.models';
import { PeriodService } from '../../catalog.services';
import { GenerateYearDialog } from '../generate-year-dialog/generate-year-dialog';
import { PeriodDueDateDialog, PeriodDueDateDialogData } from '../period-due-date-dialog/period-due-date-dialog';

type Row = TableRow<Period>;

// Un período cerrado ya no se reabre: no admite arqueos, ni cambio de fecha límite, ni eliminarse.
// Las diferencias de un mes cerrado se arreglan con correcciones en un mes abierto.
@Component({
  selector: 'app-periods-list',
  imports: [ErrorState, Filters, Table, TranslatePipe],
  templateUrl: '../../../../shared/list-page/list-page.html',
})
export class PeriodsList extends ListPage<Period> {
  private readonly dialogService = inject(DialogService);
  private readonly periodService = inject(PeriodService);
  private readonly today = localDateIso();

  protected readonly titleKey = 'nav.periods';
  protected override readonly subtitleKey = 'catalogs.periods.subtitle';

  constructor() {
    super();
    this.pageSize.set(20);
  }

  protected fetchPage(pageNumber: number, pageSize: number, filters: QueryParams) {
    return this.periodService.list(pageNumber, pageSize, filters);
  }

  protected toQuery(values: FilterValues): QueryParams {
    return { year: values['year'], status: values['status'] };
  }

  protected readonly headerButtons = computed<HeaderButton[]>(() =>
    this.authService.canWrite() ? [{ labelKey: 'catalogs.periods.generateYear', primary: true, onClick: () => this.openGenerate() }] : []
  );

  protected readonly filterFields = computed<FilterField[]>(() => {
    const year = new Date().getFullYear();
    return [
      { key: 'year', label: this.t('catalogs.columns.year'), type: 'select', options: [year - 1, year, year + 1].map((y) => ({ value: String(y), label: String(y) })) },
      {
        key: 'status',
        label: this.t('catalogs.filters.status'),
        type: 'select',
        options: (['open', 'closed'] as const).map((state) => ({ value: state, label: this.t(`catalogs.periods.states.${state}`) })),
      },
    ];
  });

  protected readonly columns = computed<TableColumn<Row>[]>(() => [
    { key: 'month', header: this.t('catalogs.columns.period'), format: (_, row) => this.periodLabel(row) },
    { key: 'dueDate', header: this.t('catalogs.columns.dueDate'), format: (v) => formatCalendarDate(v) },
    { key: 'status', header: this.t('catalogs.columns.status'), align: 'center', format: (_, row) => this.t(`catalogs.periods.states.${this.state(row)}`) },
    { key: 'closedAt', header: this.t('catalogs.columns.closedAt'), format: (v) => (v ? new Date(v as string).toLocaleString() : '') },
    { key: 'closedByFullName', header: this.t('catalogs.columns.closedBy'), format: (v) => (v as string) || '' },
  ]);

  protected readonly actions = computed<TableAction<Row>[]>(() =>
    this.authService.canWrite()
      ? [
          {
            label: this.t('catalogs.periods.editDueDate'),
            icon: 'edit',
            disabled: (row) => row.status === 'closed',
            disabledReason: () => this.t('catalogs.periods.closedLocked'),
            onClick: (row) => this.dialogService.open<boolean, PeriodDueDateDialogData>(PeriodDueDateDialog, { data: { period: row } }).closed.subscribe(this.reloadIfSaved),
          },
          {
            label: this.t('catalogs.periods.close'),
            icon: 'verified',
            disabled: (row) => row.status === 'closed',
            disabledReason: () => this.t('catalogs.periods.alreadyClosed'),
            onClick: (row) => this.confirmClose(row),
          },
          {
            label: this.t('catalogs.actions.delete'),
            icon: 'delete',
            variant: 'danger',
            disabled: (row) => row.status === 'closed',
            disabledReason: () => this.t('catalogs.periods.cannotDelete'),
            onClick: (row) => this.confirmDelete(row),
          },
        ]
      : []
  );

  /** Abierto con la fecha límite pasada cuenta como vencido (igual que el resumen del Inicio). */
  private state(row: Period): 'open' | 'overdue' | 'closed' {
    if (row.status === 'closed') return 'closed';
    return row.dueDate < this.today ? 'overdue' : 'open';
  }

  private periodLabel(row: Period): string {
    return `${this.t(`months.${row.month}`)} ${row.year}`;
  }

  private openGenerate(): void {
    this.dialogService.open<boolean>(GenerateYearDialog).closed.subscribe(this.reloadIfSaved);
  }

  private confirmClose(row: Period): void {
    const ref = this.dialogService.open<boolean, ConfirmDialogData>(ConfirmDialog, {
      data: {
        title: this.t('catalogs.periods.closeTitle', { period: this.periodLabel(row) }),
        message: this.t('catalogs.periods.closeMessage'),
        confirmLabel: this.t('catalogs.periods.close'),
      },
    });
    ref.closed.subscribe((confirmed) => confirmed && void this.run(() => this.periodService.close(row.periodId)));
  }

  private confirmDelete(row: Period): void {
    const ref = this.dialogService.open<boolean, ConfirmDialogData>(ConfirmDialog, {
      data: { title: this.t('catalogs.periods.deleteTitle'), message: this.t('catalogs.deleteMessage', { name: this.periodLabel(row) }), confirmLabel: this.t('catalogs.actions.delete') },
    });
    ref.closed.subscribe((confirmed) => confirmed && void this.run(() => this.periodService.delete(row.periodId), 'common.deleted'));
  }
}
