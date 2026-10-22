import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Las pantallas del sistema piden sesión; sin ella se va al login. */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  return authService.isAuthenticated() ? true : inject(Router).parseUrl('/login');
};

/** El login no se muestra si ya hay sesión. */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  return authService.isAuthenticated() ? inject(Router).parseUrl('/') : true;
};

/** Mismos roles que pide el [Authorize(Roles = ...)] del controlador: sin ellos, al Inicio. */
export const roleGuard =
  (...roles: string[]): CanActivateFn =>
  () => {
    const authService = inject(AuthService);
    return authService.roles().some((role) => roles.includes(role)) ? true : inject(Router).parseUrl('/');
  };
