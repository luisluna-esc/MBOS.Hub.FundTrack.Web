import { AuditLog } from '../admin.models';

export interface AuditFieldChange {
  field: string;
  before: string | null;
  after: string | null;
}

/** El backend guarda old_value y new_value como JSON de todas las columnas del registro. */
function parse(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function text(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/**
 * Campos del registro con su valor antes y después. En UPDATE solo los que cambiaron;
 * en INSERT y DELETE todos, porque el registro entero aparece o desaparece.
 */
export function changedFields(log: AuditLog): AuditFieldChange[] {
  const before = parse(log.oldValue);
  const after = parse(log.newValue);
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return fields
    .map((field) => ({ field, before: text(before[field]), after: text(after[field]) }))
    .filter((change) => log.action !== 'UPDATE' || change.before !== change.after);
}
