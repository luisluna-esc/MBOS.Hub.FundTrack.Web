import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from './auth.service';

// Igual que CheckInvoice: pone el token en cada pedido y, si el backend responde 401, renueva
// la sesión con el refresh token una sola vez (los pedidos que llegan mientras tanto esperan el
// token nuevo). Si la renovación falla, la sesión se cierra y se vuelve al login.
let refreshInProgress = false;
const refreshedToken$ = new BehaviorSubject<string | null>(null);

function isAuthEndpoint(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('/auth/login') || lower.includes('/auth/refresh');
}

function withToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function handleUnauthorized(req: HttpRequest<unknown>, next: HttpHandlerFn, authService: AuthService, router: Router): Observable<HttpEvent<unknown>> {
  if (!refreshInProgress) {
    refreshInProgress = true;
    refreshedToken$.next(null);

    return authService.refresh().pipe(
      switchMap((session) => {
        refreshInProgress = false;
        refreshedToken$.next(session.accessToken);
        return next(withToken(req, session.accessToken));
      }),
      catchError((refreshError: unknown) => {
        refreshInProgress = false;
        authService.clearSession();
        void router.navigateByUrl('/login');
        return throwError(() => refreshError);
      })
    );
  }

  return refreshedToken$.pipe(
    filter((token): token is string => token !== null),
    take(1),
    switchMap((token) => next(withToken(req, token)))
  );
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getAccessToken();
  const authReq = token && !isAuthEndpoint(req.url) ? withToken(req, token) : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || isAuthEndpoint(req.url) || !authService.isAuthenticated()) {
        return throwError(() => error);
      }
      return handleUnauthorized(req, next, authService, router);
    })
  );
};
