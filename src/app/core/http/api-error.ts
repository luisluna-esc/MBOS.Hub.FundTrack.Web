import { HttpErrorResponse } from '@angular/common/http';
import { ApiMessage } from './api.models';

const isError = (message: ApiMessage) => message.type === 1 || message.type === 'Error';

/**
 * Texto de los errores que manda el backend (validaciones de FluentValidation y reglas de negocio)
 * para mostrarlo en el toast. Null si la respuesta no trae mensajes (caída de red, 500...).
 */
export function apiErrorMessage(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const messages = (error.error as { messages?: ApiMessage[] } | null)?.messages ?? [];
  const errors = messages.filter(isError);
  const text = (errors.length ? errors : messages).map((m) => m.description).filter(Boolean);
  return text.length ? text.join(' ') : null;
}

/** Código HTTP para app-error-state (0 = sin conexión con el backend). */
export function apiErrorCode(error: unknown): number {
  if (error instanceof HttpErrorResponse) {
    return error.status === 0 ? 503 : error.status;
  }
  return 500;
}
