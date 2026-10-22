// Mismos formatos que /api/auth (LoginDto, AuthResponseDto, ChangePasswordRequestDto).

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthSession {
  appUserId: number;
  fullName: string;
  email: string;
  /** Entró con una contraseña temporal: debe cambiarla antes de usar el sistema. */
  mustChangePassword: boolean;
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
