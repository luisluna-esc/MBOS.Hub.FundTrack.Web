import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PagedResult, QueryParams, WriteResponse } from './api.models';

/** Página grande para llenar selects con un catálogo completo (regiones, distritos, iglesias...). */
export const ALL_ROWS = 1000;

// Cliente único del backend: arma la URL, limpia los filtros vacíos y desenvuelve `data`.
// Los servicios de cada pantalla solo dicen qué ruta y qué filtros usan.
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  async list<T>(path: string, pageNumber: number, pageSize: number, filters: QueryParams = {}): Promise<PagedResult<T>> {
    return this.get<PagedResult<T>>(path, { pageNumber, pageSize, ...filters });
  }

  /** Todas las filas de un catálogo (una sola página grande). */
  async all<T>(path: string, filters: QueryParams = {}): Promise<T[]> {
    return (await this.list<T>(path, 1, ALL_ROWS, filters)).items;
  }

  async get<T>(path: string, params: QueryParams = {}): Promise<T> {
    const response = await firstValueFrom(this.http.get<ApiResponse<T>>(this.url(path), { params: this.params(params) }));
    return response.data;
  }

  post(path: string, body: unknown = {}, params: QueryParams = {}): Promise<WriteResponse> {
    return firstValueFrom(this.http.post<WriteResponse>(this.url(path), body, { params: this.params(params) }));
  }

  put(path: string, body: unknown): Promise<WriteResponse> {
    return firstValueFrom(this.http.put<WriteResponse>(this.url(path), body));
  }

  delete(path: string): Promise<WriteResponse> {
    return firstValueFrom(this.http.delete<WriteResponse>(this.url(path)));
  }

  /** Para endpoints que no siguen ResponsePost (importación, archivos). */
  postRaw<T>(path: string, body: unknown, params: QueryParams = {}): Promise<T> {
    return firstValueFrom(this.http.post<T>(this.url(path), body, { params: this.params(params) }));
  }

  download(path: string, params: QueryParams = {}): Promise<Blob> {
    return firstValueFrom(this.http.get(this.url(path), { params: this.params(params), responseType: 'blob' }));
  }

  /** POST que devuelve un archivo (reportes armados con datos que manda la pantalla). */
  downloadPost(path: string, body: unknown): Promise<Blob> {
    return firstValueFrom(this.http.post(this.url(path), body, { responseType: 'blob' }));
  }

  private url(path: string): string {
    return `${environment.apiUrl}${path}`;
  }

  private params(values: QueryParams): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(values)) {
      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return params;
  }
}
