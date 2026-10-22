import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../http/api.models';
import { AuthSession, ChangePasswordRequest, LoginRequest, ROLES, WRITER_ROLES } from './auth.models';

const STORAGE_KEY = 'auth';
const ACTIVE_ROLE_STORAGE_KEY = 'activeRole';

// Igual que CheckInvoice: la sesión vive en sessionStorage (se cierra con la pestaña) y el
// "rol activo" solo decide qué menú y qué botones se muestran. La autorización real la hace el
// backend con todos los roles del token.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly session = signal<AuthSession | null>(this.readStoredSession());
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly roles = computed(() => this.session()?.roles ?? []);
  readonly activeRole = signal<string | null>(this.resolveActiveRole(this.session()?.roles ?? []));

  /** El rol activo registra y modifica datos (M-BOS o Analista); los demás solo consultan. */
  readonly canWrite = computed(() => WRITER_ROLES.includes(this.activeRole() ?? ''));
  readonly isAdmin = computed(() => this.activeRole() === ROLES.admin);

  login(request: LoginRequest): Observable<AuthSession> {
    return this.http.post<ApiResponse<AuthSession>>(`${environment.apiUrl}/auth/login`, request).pipe(
      map((response) => response.data),
      tap((session) => this.setSession(session))
    );
  }

  refresh(): Observable<AuthSession> {
    const refreshToken = this.session()?.refreshToken;
    return this.http.post<ApiResponse<AuthSession>>(`${environment.apiUrl}/auth/refresh`, { refreshToken }).pipe(
      map((response) => response.data),
      tap((session) => this.setSession(session))
    );
  }

  logout(): Observable<void> {
    const refreshToken = this.session()?.refreshToken;
    this.clearSession();
    if (!refreshToken) {
      return of(undefined);
    }
    return this.http.post<void>(`${environment.apiUrl}/auth/logout`, { refreshToken }).pipe(map(() => undefined));
  }

  async changePassword(request: ChangePasswordRequest): Promise<void> {
    await firstValueFrom(this.http.post(`${environment.apiUrl}/auth/change-password`, request));
    const session = this.session();
    if (session) {
      this.store({ ...session, mustChangePassword: false });
    }
  }

  getAccessToken(): string | null {
    return this.session()?.accessToken ?? null;
  }

  setActiveRole(role: string): void {
    if (!this.roles().includes(role)) {
      return;
    }
    this.activeRole.set(role);
    sessionStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, role);
  }

  setSession(session: AuthSession): void {
    this.store(session);
    const role = this.resolveActiveRole(session.roles);
    this.activeRole.set(role);
    if (role) {
      sessionStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, role);
    } else {
      sessionStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
    }
  }

  clearSession(): void {
    this.session.set(null);
    sessionStorage.removeItem(STORAGE_KEY);
    this.activeRole.set(null);
    sessionStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
  }

  private store(session: AuthSession): void {
    this.session.set(session);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  private readStoredSession(): AuthSession | null {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthSession;
    } catch {
      return null;
    }
  }

  private resolveActiveRole(roles: string[]): string | null {
    const stored = sessionStorage.getItem(ACTIVE_ROLE_STORAGE_KEY);
    if (stored && roles.includes(stored)) {
      return stored;
    }
    return roles[0] ?? null;
  }
}
