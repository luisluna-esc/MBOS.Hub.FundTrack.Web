import { BadgeTone } from '../../shared/components/badge/badge';
import { LocalFundCount } from './funds.models';

/** Estado que se muestra de una iglesia en un mes, con su color y su texto (clave i18n). */
export interface CountStatusView {
  tone: BadgeTone;
  labelKey: string;
}

// Un solo lugar que decide cómo se ve cada estado, para que el registro del mes, la bandeja de
// diferencias y el diálogo usen siempre el mismo color y texto. En el registro del mes ('month')
// una diferencia sin seguimiento se muestra "Con diferencia": el arqueo ya está completo y
// "Pendiente" hacía pensar que faltaba registrarlo. En la bandeja de diferencias sigue siendo
// "Pendiente" hasta que la Misión la marque como resuelta.
export function countStatus(count: LocalFundCount | null, view: 'month' | 'followUp' = 'followUp'): CountStatusView {
  if (!count) {
    return { tone: 'neutral', labelKey: 'funds.status.missing' };
  }
  if (count.submissionStatus === 'not_submitted') {
    return { tone: 'danger', labelKey: 'funds.status.notSubmitted' };
  }
  // Lo que manda es el monto: si no cuadra, nunca se muestra "Sin diferencia", aunque el estado
  // guardado sea uno viejo o desconocido.
  if (count.difference === 0) {
    return { tone: 'success', labelKey: 'funds.status.noDifference' };
  }
  if (count.differenceStatus === 'resolved') {
    return { tone: 'success', labelKey: 'funds.status.resolved' };
  }
  return { tone: 'warning', labelKey: view === 'month' ? 'funds.status.withDifference' : 'funds.status.pending' };
}

/** Falta dinero en rojo, sobra en celeste, cuadra en gris. */
export function differenceClass(value: number): string {
  if (value < 0) {
    return 'text-danger';
  }
  return value > 0 ? 'text-info' : 'text-muted-foreground';
}
