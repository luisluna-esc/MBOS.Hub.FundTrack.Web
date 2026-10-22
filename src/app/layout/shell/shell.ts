import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { DialogService } from '../../core/dialog/dialog.service';
import { LanguageService } from '../../core/i18n/language.service';
import { MenuTreeItem } from '../../core/menu/menu.models';
import { MenuService } from '../../core/menu/menu.service';
import { ThemeService } from '../../core/theme/theme.service';
import { Icon } from '../../shared/components/icon/icon';
import { LanguageSwitcher } from '../../shared/components/language-switcher/language-switcher';
import { Select, SelectOption } from '../../shared/components/select/select';
import { ThemeToggle } from '../../shared/components/theme-toggle/theme-toggle';
import { Tooltip } from '../../shared/components/tooltip/tooltip';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { ChangePasswordDialog } from '../../features/auth/change-password-dialog/change-password-dialog';

const SIDEBAR_STORAGE_KEY = 'sidebarCollapsed';

// Mismo layout que InvenTrack: menú lateral que se colapsa a solo íconos, cuenta con selector de
// rol, idioma y tema abajo, y panel deslizable en celular. El menú sale de GET /api/menus/my-menu
// filtrado por el rol activo.
@Component({
  selector: 'app-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    NgTemplateOutlet,
    FormsModule,
    Icon,
    LanguageSwitcher,
    Select,
    ThemeToggle,
    Tooltip,
    TranslatePipe,
  ],
  templateUrl: './shell.html',
})
export class Shell {
  private readonly languageService = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  protected readonly authService = inject(AuthService);
  protected readonly menuService = inject(MenuService);
  protected readonly themeService = inject(ThemeService);

  protected readonly mobileNavOpen = signal(false);
  protected readonly collapsed = signal(localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true');
  protected readonly accountMenuOpen = signal(false);
  protected readonly expandedItems = signal<ReadonlySet<number>>(new Set());

  protected readonly username = computed(() => this.authService.session()?.username ?? '');
  protected readonly activeRole = computed(() => this.authService.activeRole() ?? '');
  protected readonly initials = computed(() => this.authService.session()?.fullName.charAt(0).toUpperCase() || '?');

  protected readonly roleOptions = computed<SelectOption[]>(() =>
    this.authService.roles().map((role) => ({ value: role, label: role }))
  );

  /** Solo los items que tiene marcados el rol activo (menu_role), no la unión de todos sus roles. */
  protected readonly visibleNavItems = computed<MenuTreeItem[]>(() => this.filterByActiveRole(this.menuService.items()));

  /**
   * Todas las rutas visibles, para saber cuándo una ruta es prefijo de otra (ej. "/funds" de
   * "/funds/counts"): en ese caso hace falta coincidencia exacta o se pintan activos los dos.
   */
  private readonly allVisibleRoutes = computed<string[]>(() =>
    this.visibleNavItems().flatMap((item) => [
      ...(item.route ? [item.route] : []),
      ...item.children.map((child) => child.route).filter((route): route is string => !!route),
    ])
  );

  /** Logo azul sobre el menú claro y blanco sobre el oscuro. */
  protected readonly logoSrc = computed(() =>
    this.themeService.theme() === 'dark' ? 'img/fund-track-blanco.png' : 'img/fund-track-azul.png'
  );
  protected readonly iconLogoSrc = computed(() =>
    this.themeService.theme() === 'dark' ? 'img/fund-track-icono-blanco.png' : 'img/fund-track-icono-azul.png'
  );

  constructor() {
    void this.menuService.loadMyMenu();

    effect(() => {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(this.collapsed()));
    });
  }

  /** Cambiar la contraseña es voluntario, desde el menú de la cuenta. */
  protected openChangePassword(): void {
    this.accountMenuOpen.set(false);
    this.dialogService.open<boolean>(ChangePasswordDialog);
  }

  private filterByActiveRole(items: MenuTreeItem[]): MenuTreeItem[] {
    const role = this.activeRole();
    return items
      .filter((item) => item.roles.includes(role))
      .map((item) => ({ ...item, children: this.filterByActiveRole(item.children) }))
      .filter((item) => item.children.length > 0 || !!item.route);
  }

  protected toggleCollapsed(): void {
    this.collapsed.update((value) => !value);
  }

  protected toggleAccountMenu(): void {
    if (this.collapsed()) {
      this.collapsed.set(false);
    }
    this.accountMenuOpen.update((value) => !value);
  }

  protected isExactMatch(route: string | null): boolean {
    if (!route || route === '/') {
      return true;
    }
    return this.allVisibleRoutes().some((other) => other !== route && other.startsWith(`${route}/`));
  }

  protected displayName(item: MenuTreeItem): string {
    return item.translationKey ? this.languageService.t(item.translationKey) : item.name;
  }

  protected isExpanded(menuId: number): boolean {
    return this.expandedItems().has(menuId);
  }

  protected toggleExpanded(menuId: number): void {
    this.expandedItems.update((current) => {
      const next = new Set(current);
      if (next.has(menuId)) {
        next.delete(menuId);
      } else {
        next.add(menuId);
      }
      return next;
    });
  }

  /** Cambiar de rol cambia el menú; si la pantalla actual ya no está en él, vuelve al Inicio. */
  protected onRoleChange(role: string | null): void {
    if (!role) {
      return;
    }
    this.authService.setActiveRole(role);
    const current = this.router.url.split('?')[0];
    if (current !== '/' && !this.allVisibleRoutes().some((route) => route !== '/' && current.startsWith(route))) {
      void this.router.navigateByUrl('/');
    }
  }

  protected onLogout(): void {
    this.authService.logout().subscribe({
      complete: () => {
        this.menuService.clear();
        void this.router.navigateByUrl('/login');
      },
      error: () => {
        this.menuService.clear();
        void this.router.navigateByUrl('/login');
      },
    });
  }
}
