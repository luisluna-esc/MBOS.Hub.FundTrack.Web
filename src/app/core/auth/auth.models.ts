// Mismos formatos que /api/auth (LoginDto, AuthResponseDto, ChangePasswordRequestDto).

export interface LoginRequest {
  /** nombre.apellido */
  username: string;
  password: string;
}

export interface AuthSession {
  appUserId: number;
  fullName: string;
  username: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  roles: string[];
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** Mismos nombres que RoleNames del backend. */
export const ROLES = {
  admin: 'M-BOS',
  analyst: 'Analista',
  administrator: 'Administrador',
  treasurer: 'Tesorero',
  auditor: 'Auditor',
  pastor: 'Pastor',
} as const;

/** RoleNames.Writers: los únicos que registran y modifican datos. */
export const WRITER_ROLES: string[] = [ROLES.admin, ROLES.analyst];
