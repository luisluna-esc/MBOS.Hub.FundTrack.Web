// Mismos formatos que devuelve el backend en /api/local-fund-counts.

export type SubmissionStatus = 'submitted' | 'not_submitted';
export type DifferenceStatus = 'none' | 'pending' | 'resolved';
export type CorrectionField = 'acms_balance' | 'total_amount';

/** LocalFundCountDto */
export interface LocalFundCount {
  localFundCountId: number;
  churchId: number;
  churchCode: string;
  churchName: string;
  periodId: number;
  periodYear: number;
  periodMonth: number;
  periodStatus: 'open' | 'closed';
  districtId: number;
  districtName: string;
  regionId: number | null;
  regionName: string;
  pastorId: number | null;
  pastorName: string | null;
  churchType: string;
  submissionStatus: SubmissionStatus;
  acmsBalance: number;
  bankStatementBalance: number;
  bankDeposit: number;
  /** Billetes y monedas en moneda nacional (fondo local). */
  localCash: number;
  usdAmount: number;
  exchangeRate: number;
  usdAmountBs: number;
  documentsTotal: number;
  /** Total fondos en custodia del tesorero: los 4 montos más los documentos. */
  totalAmount: number;
  /** totalAmount menos acmsBalance: negativo falta dinero, positivo sobra. */
  difference: number;
  differenceStatus: DifferenceStatus | null;
  countDate: string | null;
  treasurerName: string | null;
  elderName: string | null;
  signedByPastor: boolean;
  signedByElder: boolean;
  observation: string | null;
  attachmentCount: number;
  correctionCount: number;
  createdByFullName: string | null;
  createdAt: string;
  updatedByFullName: string | null;
  updatedAt: string | null;
}

/** LocalFundCountRequestDto: cuerpo de POST y PUT. Si no presentó, el backend ignora los montos del arqueo. */
export interface LocalFundCountRequest {
  churchId: number;
  periodId: number;
  submissionStatus: SubmissionStatus;
  acmsBalance: number;
  bankStatementBalance: number;
  bankDeposit: number;
  localCash: number;
  usdAmount: number;
  exchangeRate: number;
  countDate: string | null;
  treasurerName: string | null;
  elderName: string | null;
  signedByPastor: boolean;
  signedByElder: boolean;
  /** Por qué hay diferencia: obligatoria cuando no cuadra con el ACMS. */
  observation: string | null;
  documents: LocalFundCountDocumentRequest[];
}

/** Factura, recibo u otro documento a rendir: su monto se suma al total en custodia. */
export interface LocalFundCountDocumentRequest {
  documentDate: string;
  documentNumber: string | null;
  detail: string;
  amount: number;
}

/** LocalFundCountDocumentDto */
export interface LocalFundCountDocument extends LocalFundCountDocumentRequest {
  localFundCountDocumentId: number;
  localFundCountId: number;
}

export interface DifferenceFollowUpRequest {
  newStatus: 'resolved';
  justification: string;
}

export interface CorrectionRequest {
  fieldName: CorrectionField;
  correctedAmount: number;
  reason: string;
}

/** PeriodCountRowDto: una fila de la vista del mes, con o sin arqueo. */
export interface PeriodCountRow {
  churchId: number;
  churchCode: string;
  churchName: string;
  churchType: string;
  districtId: number;
  districtName: string;
  regionId: number | null;
  regionName: string;
  pastorName: string | null;
  filialCount: number;
  localFundCount: LocalFundCount | null;
}

/** DifferenceFollowUpDto */
export interface DifferenceFollowUp {
  differenceFollowUpId: number;
  previousStatus: DifferenceStatus | null;
  newStatus: DifferenceStatus;
  justification: string;
  appUserFullName: string | null;
  followedUpAt: string;
}

/** LocalFundCountCorrectionDto */
export interface LocalFundCountCorrection {
  localFundCountCorrectionId: number;
  appliedPeriodYear: number;
  appliedPeriodMonth: number;
  fieldName: CorrectionField;
  previousAmount: number;
  correctedAmount: number;
  reason: string;
  appUserFullName: string | null;
  registeredAt: string;
}

/** LocalFundCountAttachmentDto */
export interface LocalFundCountAttachment {
  localFundCountAttachmentId: number;
  localFundCountId: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  appUserFullName: string | null;
  registeredAt: string;
}
