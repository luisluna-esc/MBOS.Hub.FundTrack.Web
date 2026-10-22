import { Injectable, inject } from '@angular/core';
import { QueryParams } from '../../core/http/api.models';
import { ApiService } from '../../core/http/api.service';
import {
  Church,
  ChurchCloseRequest,
  ChurchHistory,
  ChurchRequest,
  District,
  DistrictPastor,
  DistrictPastorAssignRequest,
  DistrictRequest,
  ImportResult,
  Pastor,
  PastorRequest,
  Period,
  Region,
} from './catalog.models';

// Un servicio por recurso, cada uno con sus endpoints de /api. Los filtros de las listas usan los
// mismos nombres que los QueryFilter del backend (RegionQueryFilter, ChurchQueryFilter...).

@Injectable({ providedIn: 'root' })
export class RegionService {
  private readonly api = inject(ApiService);

  list = (pageNumber: number, pageSize: number, filters: QueryParams) => this.api.list<Region>('/regions', pageNumber, pageSize, filters);
  all = () => this.api.all<Region>('/regions');
  create = (region: Region) => this.api.post('/regions', region);
  update = (region: Region) => this.api.put(`/regions/${region.regionId}`, region);
  delete = (regionId: number) => this.api.delete(`/regions/${regionId}`);
}

@Injectable({ providedIn: 'root' })
export class DistrictService {
  private readonly api = inject(ApiService);

  list = (pageNumber: number, pageSize: number, filters: QueryParams) => this.api.list<District>('/districts', pageNumber, pageSize, filters);
  all = () => this.api.all<District>('/districts');
  create = (request: DistrictRequest) => this.api.post('/districts', request);
  update = (districtId: number, request: DistrictRequest) => this.api.put(`/districts/${districtId}`, request);
  delete = (districtId: number) => this.api.delete(`/districts/${districtId}`);
  pastorHistory = (districtId: number) => this.api.get<DistrictPastor[]>(`/districts/${districtId}/pastors`);
  assignPastor = (districtId: number, request: DistrictPastorAssignRequest) => this.api.post(`/districts/${districtId}/pastor`, request);
}

@Injectable({ providedIn: 'root' })
export class PastorService {
  private readonly api = inject(ApiService);

  list = (pageNumber: number, pageSize: number, filters: QueryParams) => this.api.list<Pastor>('/pastors', pageNumber, pageSize, filters);
  all = () => this.api.all<Pastor>('/pastors');
  create = (request: PastorRequest) => this.api.post('/pastors', request);
  update = (pastorId: number, request: PastorRequest) => this.api.put(`/pastors/${pastorId}`, request);
  delete = (pastorId: number) => this.api.delete(`/pastors/${pastorId}`);
}

@Injectable({ providedIn: 'root' })
export class ChurchService {
  private readonly api = inject(ApiService);

  list = (pageNumber: number, pageSize: number, filters: QueryParams) => this.api.list<Church>('/churches', pageNumber, pageSize, filters);
  all = (filters: QueryParams = {}) => this.api.all<Church>('/churches', filters);
  create = (request: ChurchRequest) => this.api.post('/churches', request);
  update = (churchId: number, request: ChurchRequest) => this.api.put(`/churches/${churchId}`, request);
  close = (churchId: number, request: ChurchCloseRequest) => this.api.post(`/churches/${churchId}/close`, request);
  history = (churchId: number) => this.api.get<ChurchHistory[]>(`/churches/${churchId}/history`);

  /** Revisa (dryRun) o guarda el Excel de iglesias. Todo o nada: con un error no guarda ninguna fila. */
  import(file: File, dryRun: boolean, pastorStartDate: string | null): Promise<{ data: ImportResult }> {
    const body = new FormData();
    body.append('file', file);
    return this.api.postRaw<{ data: ImportResult }>('/imports/churches', body, { dryRun, pastorStartDate });
  }

  importTemplate = () => this.api.download('/imports/churches/template');
}

@Injectable({ providedIn: 'root' })
export class PeriodService {
  private readonly api = inject(ApiService);

  list = (pageNumber: number, pageSize: number, filters: QueryParams) => this.api.list<Period>('/periods', pageNumber, pageSize, filters);
  all = (filters: QueryParams = {}) => this.api.all<Period>('/periods', filters);
  generateYear = (year: number) => this.api.post(`/periods/generate-year/${year}`);
  updateDueDate = (periodId: number, dueDate: string) => this.api.put(`/periods/${periodId}/due-date`, { dueDate });
  close = (periodId: number) => this.api.post(`/periods/${periodId}/close`);
  delete = (periodId: number) => this.api.delete(`/periods/${periodId}`);
}
