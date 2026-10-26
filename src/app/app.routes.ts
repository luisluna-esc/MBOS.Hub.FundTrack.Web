import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth/auth.guard';
import { ROLES } from './core/auth/auth.models';

const placeholder = () => import('./features/placeholder/placeholder-page').then((m) => m.PlaceholderPage);

/** Opciones del menú que todavía muestran la pantalla provisional (se reemplazan una por una). */
const MENU_ROUTES: { path: string; titleKey: string; icon: string }[] = [
];

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    // Pantalla de prueba del sistema de estilos: muestra los colores de src/styles/theme.scss
    // en todos los componentes, en claro y en oscuro.
    path: 'style-guide',
    loadComponent: () => import('./features/style-guide/style-guide').then((m) => m.StyleGuide),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./features/dashboard/home/home').then((m) => m.Home),
      },
      {
        path: 'funds/counts',
        loadComponent: () => import('./features/funds/counts/counts-month/counts-month').then((m) => m.CountsMonth),
      },
      {
        path: 'funds/differences',
        loadComponent: () =>
          import('./features/funds/differences/differences-list/differences-list').then((m) => m.DifferencesList),
      },
      {
        path: 'catalogs/regions',
        loadComponent: () => import('./features/catalogs/regions/regions-list/regions-list').then((m) => m.RegionsList),
      },
      {
        path: 'catalogs/districts',
        loadComponent: () => import('./features/catalogs/districts/districts-list/districts-list').then((m) => m.DistrictsList),
      },
      {
        path: 'catalogs/pastors',
        loadComponent: () => import('./features/catalogs/pastors/pastors-list/pastors-list').then((m) => m.PastorsList),
      },
      {
        path: 'catalogs/churches',
        loadComponent: () => import('./features/catalogs/churches/churches-list/churches-list').then((m) => m.ChurchesList),
      },
      {
        path: 'catalogs/periods',
        loadComponent: () => import('./features/catalogs/periods/periods-list/periods-list').then((m) => m.PeriodsList),
      },
      {
        path: 'admin/users',
        canActivate: [roleGuard(ROLES.admin)],
        loadComponent: () => import('./features/admin/users/users-list/users-list').then((m) => m.UsersList),
      },
      {
        path: 'admin/roles',
        canActivate: [roleGuard(ROLES.admin)],
        loadComponent: () => import('./features/admin/roles/roles-list/roles-list').then((m) => m.RolesList),
      },
      {
        path: 'admin/audit-logs',
        canActivate: [roleGuard(ROLES.admin, ROLES.analyst, ROLES.administrator)],
        loadComponent: () => import('./features/admin/audit-logs/audit-logs-list/audit-logs-list').then((m) => m.AuditLogsList),
      },
      {
        path: 'charts',
        loadComponent: () => import('./features/charts/charts-page/charts-page').then((m) => m.ChartsPage),
      },
      {
        // Los reportes usan la misma pantalla; :report dice cuál (features/reports/report-definitions.ts).
        path: 'reports/:report',
        loadComponent: () => import('./features/reports/report-page/report-page').then((m) => m.ReportPage),
      },
      ...MENU_ROUTES.map(({ path, titleKey, icon }) => ({
        path,
        pathMatch: 'full' as const,
        loadComponent: placeholder,
        data: { titleKey, icon },
      })),
    ],
  },
  { path: '**', redirectTo: '' },
];
