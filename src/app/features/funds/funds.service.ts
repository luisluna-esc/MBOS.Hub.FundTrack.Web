import { Injectable, inject } from '@angular/core';
import { QueryParams } from '../../core/http/api.models';
import { ApiService } from '../../core/http/api.service';
import {
  CorrectionRequest,
  DifferenceFollowUp,
  DifferenceFollowUpRequest,
  LocalFundCount,
  LocalFundCountAttachment,
  LocalFundCountCorrection,
  LocalFundCountDocument,
  LocalFundCountRequest,
  PeriodCountRow,
} from './funds.models';

// Endpoints de /api/local-fund-counts. El backend ya limita a un Pastor a su distrito.
@Injectable({ providedIn: 'root' })
export class FundsService {
  private readonly api = inject(ApiService);
  private readonly base = '/local-fund-counts';

  /** La vista del mes: cada Iglesia o Grupo activo con su arqueo, o sin él si falta registrarlo. */
  byPeriod = (periodId: number, regionId?: string | null, districtId?: string | null) =>
    this.api.get<PeriodCountRow[]>(`${this.base}/by-period/${periodId}`, { regionId, districtId });

  list = (pageNumber: number, pageSize: number, filters: QueryParams) => this.api.list<LocalFundCount>(this.base, pageNumber, pageSize, filters);
  get = (id: number) => this.api.get<LocalFundCount>(`${this.base}/${id}`);
  create = (request: LocalFundCountRequest) => this.api.post(this.base, request);
  update = (id: number, request: LocalFundCountRequest) => this.api.put(`${this.base}/${id}`, request);
  delete = (id: number) => this.api.delete(`${this.base}/${id}`);

  /** La hoja "Arqueo del fondo local" en PDF, con las tres firmas. */
  voucherPdf = (id: number) => this.api.download('/reports/local-fund-count/pdf', { localFundCountId: id });

  documents = (id: number) => this.api.get<LocalFundCountDocument[]>(`${this.base}/${id}/documents`);

  followUps = (id: number) => this.api.get<DifferenceFollowUp[]>(`${this.base}/${id}/follow-ups`);
  addFollowUp = (id: number, request: DifferenceFollowUpRequest) => this.api.post(`${this.base}/${id}/follow-ups`, request);

  corrections = (id: number) => this.api.get<LocalFundCountCorrection[]>(`${this.base}/${id}/corrections`);
  addCorrection = (id: number, request: CorrectionRequest) => this.api.post(`${this.base}/${id}/corrections`, request);

  attachments = (id: number) => this.api.get<LocalFundCountAttachment[]>(`${this.base}/${id}/attachments`);
  downloadAttachment = (id: number, attachmentId: number) => this.api.download(`${this.base}/${id}/attachments/${attachmentId}`);
  deleteAttachment = (id: number, attachmentId: number) => this.api.delete(`${this.base}/${id}/attachments/${attachmentId}`);

  uploadAttachment(id: number, file: File) {
    const body = new FormData();
    body.append('file', file);
    return this.api.post(`${this.base}/${id}/attachments`, body);
  }
}

/** Mismos tipos y tamaño que acepta LocalFundCountAttachmentService (appsettings Attachments). */
export const ATTACHMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

