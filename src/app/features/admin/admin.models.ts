// Mismos formatos que los DTOs del backend (FundTrack.Application/Dtos/Security y Audit).

/** AppUserDto (también es el cuerpo de POST y PUT /api/appusers). */
export interface AppUser {
  appUserId: number;
  ci: string | null;
  fullName: string;
  /** nombre.apellido: con esto se entra al sistema. */
  username: string;
  phone: string | null;
  pastorId: number | null;
  /** Solo al crear o al cambiarla: la contraseña. Nunca viene en las respuestas. */
  password?: string | null;
  passwordChangedAt?: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  isActive: boolean;
  lastLogin: string | null;
  createdById?: number | null;
  createdAt?: string;
}

/** RoleDto */
export interface Role {
  roleId: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt?: string;
}

/** MenuDto */
export interface Menu {
  menuId: number;
  name: string;
  translationKey: string | null;
  route: string | null;
  icon: string | null;
  parentMenuId: number | null;
  displayOrder: number;
  isActive: boolean;
}

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

/** AuditLogDto */
export interface AuditLog {
  auditLogId: number;
  appUserId: number | null;
  appUserFullName: string | null;
  action: AuditAction;
  module: string | null;
  tableName: string;
  recordId: number | null;
  description: string | null;
  oldValue: string | null;
  newValue: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

/** Tablas que registra la auditoría, para el filtro. */
export const AUDITED_TABLES = [
  'app_user',
  'app_user_role',
  'role',
  'menu',
  'menu_role',
  'region',
  'district',
  'district_pastor',
  'pastor',
  'church',
  'church_history',
  'period',
  'local_fund_count',
  'local_fund_count_attachment',
  'local_fund_count_correction',
  'difference_follow_up',
];
