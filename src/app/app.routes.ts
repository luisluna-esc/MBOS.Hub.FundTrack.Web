import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    // Pantalla de prueba del sistema de estilos: muestra los colores de src/styles/theme.scss
    // en todos los componentes, en claro y en oscuro.
    path: 'style-guide',
    loadComponent: () => import('./features/style-guide/style-guide').then((m) => m.StyleGuide),
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
];
