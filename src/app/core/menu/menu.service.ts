import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../http/api.service';
import { MenuTreeItem } from './menu.models';

@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly api = inject(ApiService);

  readonly items = signal<MenuTreeItem[]>([]);
  readonly loaded = signal(false);

  /** GET /api/menus/my-menu: el árbol que ve el usuario, con los roles que marcan cada ítem. */
  async loadMyMenu(): Promise<void> {
    try {
      this.items.set(await this.api.get<MenuTreeItem[]>('/menus/my-menu'));
    } catch {
      this.items.set([]);
    } finally {
      this.loaded.set(true);
    }
  }

  clear(): void {
    this.items.set([]);
    this.loaded.set(false);
  }
}
