// Mismos formatos que los DTOs del backend (FundTrack.Application/Dtos/Organization).

/** RegionDto (también es el cuerpo de POST y PUT /api/regions). */
export interface Region {
  regionId: number;
  name: string;
  isActive: boolean;
  createdAt?: string;
  pendingBalance: number;
}

/** DistrictDto */
export interface District {
  districtId: number;
  regionId: number;
  regionName: string | null;
  name: string;
  isMissionary: boolean;
  isActive: boolean;
  createdAt: string;
  currentPastorId: number | null;
  currentPastorName: string | null;
  churchCount: number;
}

export interface DistrictRequest {
  regionId: number;
  name: string;
  isMissionary: boolean;
  isActive: boolean;
}

/** DistrictPastorDto */
export interface DistrictPastor {
  districtPastorId: number;
  districtId: number;
  districtName: string | null;
  pastorId: number;
  pastorName: string | null;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
}

export interface DistrictPastorAssignRequest {
  pastorId: number;
  startDate: string;
}

/** PastorDto */
export interface Pastor {
  pastorId: number;
  ci: string | null;
  firstNames: string;
  lastNames: string;
  /** "APELLIDOS, Nombres", igual que en el Excel. */
  fullName: string;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  currentDistrictId: number | null;
  currentDistrictName: string | null;
}

export interface PastorRequest {
  ci: string | null;
  firstNames: string;
  lastNames: string;
  email: string | null;
  isActive: boolean;
}

export type ChurchType = 'Iglesia' | 'Grupo' | 'Filial';
export type ChurchStatus = 'active' | 'closed' | 'merged';

/** ChurchDto */
export interface Church {
  churchId: number;
  code: string;
  name: string;
  type: ChurchType;
  districtId: number;
  districtName: string | null;
  regionId: number | null;
  regionName: string | null;
  currentPastorName: string | null;
  address: string | null;
  phone: string | null;
  treasurerName: string | null;
  treasurerPhone: string | null;
  elderName: string | null;
  elderPhone: string | null;
  status: ChurchStatus;
  mergedIntoChurchId: number | null;
  mergedIntoChurchName: string | null;
  closedAt: string | null;
  createdAt: string;
  parentChurchId: number | null;
  parentChurchName: string | null;
  /** Cuántas Filiales dependen de esta Iglesia o Grupo. */
  filialCount: number;
}

export interface ChurchRequest {
  /** En una Filial el backend lo ignora: toma el código de su madre. */
  code: string;
  parentChurchId: number | null;
  name: string;
  type: ChurchType;
  districtId: number;
  address: string | null;
  phone: string | null;
  treasurerName: string | null;
  treasurerPhone: string | null;
  elderName: string | null;
  elderPhone: string | null;
  /** Desde cuándo rige un cambio de tipo, distrito o nombre (queda en el historial). */
  changeDate: string | null;
  changeReason: string | null;
}

export interface ChurchCloseRequest {
  status: 'closed' | 'merged';
  closedAt: string;
  reason: string;
  mergedIntoChurchId: number | null;
}

/** ChurchHistoryDto */
export interface ChurchHistory {
  churchHistoryId: number;
  churchId: number;
  changeType: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
  reason: string | null;
  appUserId: number | null;
  appUserFullName: string | null;
  registeredAt: string;
}

/** PeriodDto */
export interface Period {
  periodId: number;
  year: number;
  month: number;
  dueDate: string;
  status: 'open' | 'closed';
  closedAt: string | null;
  closedById: number | null;
  closedByFullName: string | null;
}

/** El mes ya empezó (no es de un mes o año futuro): solo esos se registran o se consultan. */
export function isStartedPeriod(period: { year: number; month: number }, today: Date = new Date()): boolean {
  const year = today.getFullYear();
  return period.year < year || (period.year === year && period.month <= today.getMonth() + 1);
}

/** ImportResultDto de POST /api/imports/churches. */
export interface ImportIssue {
  row: number;
  message: string;
}

export interface ImportResult {
  dryRun: boolean;
  saved: boolean;
  totalRows: number;
  regionsCreated: number;
  districtsCreated: number;
  pastorsCreated: number;
  churchesCreated: number;
  filialsCreated: number;
  pastorAssignmentsCreated: number;
  churchesSkipped: number;
  errors: ImportIssue[];
  warnings: ImportIssue[];
}
