import { Directive, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorCode, apiErrorMessage } from '../../core/http/api-error';
import { PagedResult, QueryParams } from '../../core/http/api.models';
import { LanguageService } from '../../core/i18n/language.service';
import { ToastService } from '../../core/toast/toast.service';
import { FilterValues } from '../components/filters/filters';

/** Botón del encabezado de la lista (crear, generar año, importar...). */
export interface HeaderButton {
  labelKey: string;
  primary?: boolean;
  onClick: () => void;
}

/** Fila para app-table: el modelo con índice de texto, como pide TableColumn. */
export type TableRow<T> = T & Record<string, unknown>;

// Base de las pantallas de lista (mismo comportamiento que las listas de CheckInvoice): cada
// búsqueda o cambio de página pide al backend la página con los filtros como query string.
// Cada lista solo dice cómo traducir sus filtros (toQuery) y qué endpoint llama (fetchPage).
@Directive()
export abstract class ListPage<T> {
  protected abstract readonly titleKey: string;
  protected readonly subtitleKey: string | null = null;

  protected readonly languageService = inject(LanguageService);
  protected readonly toastService = inject(ToastService);
  protected readonly authService = inject(AuthService);

  protected readonly rows = signal<T[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly loading = signal(false);
  protected readonly errorCode = signal<number | null>(null);

  private filters: QueryParams = {};

  protected abstract fetchPage(pageNumber: number, pageSize: number, filters: QueryParams): Promise<PagedResult<T>>;

  /** Filtros de pantalla (app-filters) a los nombres del QueryFilter del backend. */
  protected abstract toQuery(values: FilterValues): QueryParams;

  constructor() {
    // Después del constructor de la lista hija, para que sus servicios ya estén inyectados.
    queueMicrotask(() => void this.reload());
  }

  protected async reload(): Promise<void> {
    this.errorCode.set(null);
    this.loading.set(true);
    try {
      const result = await this.fetchPage(this.pageNumber(), this.pageSize(), this.filters);
      this.rows.set(result.items);
      this.totalRecords.set(result.totalRecords);
    } catch (error) {
      this.errorCode.set(apiErrorCode(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected onSearch(values: FilterValues): void {
    this.filters = this.toQuery(values);
    this.pageNumber.set(1);
    void this.reload();
  }

  protected onClear(): void {
    this.filters = {};
    this.pageNumber.set(1);
    void this.reload();
  }

  protected onPageChange(page: number): void {
    this.pageNumber.set(page);
    void this.reload();
  }

  protected onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.pageNumber.set(1);
    void this.reload();
  }

  protected t(key: string, params?: Record<string, string | number>): string {
    return this.languageService.t(key, params);
  }

  /** "true"/"false" del select de estado a booleano; vacío = sin filtro. */
  protected bool(value: string | null | undefined): boolean | undefined {
    return value ? value === 'true' : undefined;
  }

  /** Ejecuta un guardado o borrado: muestra el resultado y recarga la lista si salió bien. */
  protected async run(action: () => Promise<unknown>, successKey = 'common.saved'): Promise<boolean> {
    try {
      await action();
      this.toastService.show(this.t(successKey));
      void this.reload();
      return true;
    } catch (error) {
      this.toastService.show(this.t('common.saveError'), apiErrorMessage(error) ?? undefined);
      return false;
    }
  }

  /** Recarga cuando un diálogo de alta o edición cierra con `true`. */
  protected reloadIfSaved = (saved: boolean | undefined): void => {
    if (saved) {
      void this.reload();
    }
  };
}
