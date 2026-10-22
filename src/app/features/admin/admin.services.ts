import { Injectable, inject } from '@angular/core';
import { QueryParams } from '../../core/http/api.models';
import { ApiService } from '../../core/http/api.service';
import { AppUser, AuditLog, Menu, Role } from './admin.models';

// Usuarios, roles y menús son solo de M-BOS ([Authorize(Roles = RoleNames.Admin)]); la auditoría
// la ven también Analista y Administrador.

@Injectable({ providedIn: 'root' })
export class AppUserService {
  private readonly api = inject(ApiService);

  list = (pageNumber: number, pageSize: number, filters: QueryParams) => this.api.list<AppUser>('/appusers', pageNumber, pageSize, filters);
  all = () => this.api.all<AppUser>('/appusers');
  create = (user: AppUser) => this.api.post('/appusers', user);
  update = (user: AppUser) => this.api.put(`/appusers/${user.appUserId}`, user);
  delete = (appUserId: number) => this.api.delete(`/appusers/${appUserId}`);
  roles = (appUserId: number) => this.api.get<Role[]>(`/appusers/${appUserId}/roles`);
  assignRole = (appUserId: number, roleId: number) => this.api.post(`/appusers/${appUserId}/roles/${roleId}`);
  removeRole = (appUserId: number, roleId: number) => this.api.delete(`/appusers/${appUserId}/roles/${roleId}`);
}

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly api = inject(ApiService);

  list = (pageNumber: number, pageSize: number, filters: QueryParams) => this.api.list<Role>('/roles', pageNumber, pageSize, filters);
  all = () => this.api.all<Role>('/roles');
  create = (role: Role) => this.api.post('/roles', role);
  update = (role: Role) => this.api.put(`/roles/${role.roleId}`, role);
  delete = (roleId: number) => this.api.delete(`/roles/${roleId}`);
  menus = (roleId: number) => this.api.get<Menu[]>(`/roles/${roleId}/menus`);
  assignMenu = (roleId: number, menuId: number) => this.api.post(`/roles/${roleId}/menus/${menuId}`);
  removeMenu = (roleId: number, menuId: number) => this.api.delete(`/roles/${roleId}/menus/${menuId}`);
}

@Injectable({ providedIn: 'root' })
export class MenuAdminService {
  private readonly api = inject(ApiService);

  all = () => this.api.all<Menu>('/menus');
}

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly api = inject(ApiService);

  list = (pageNumber: number, pageSize: number, filters: QueryParams) => this.api.list<AuditLog>('/auditlogs', pageNumber, pageSize, filters);
}
