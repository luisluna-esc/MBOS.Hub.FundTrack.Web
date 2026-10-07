import { Component, computed, input } from '@angular/core';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'info' | 'danger';

// Etiqueta de estado (por ejemplo, el estado de una diferencia). El color sale de los tokens de
// estado de theme.scss: fondo suave del mismo tono y texto fuerte, en claro y en oscuro.
const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'border-border bg-surface text-muted-foreground',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  info: 'border-info/30 bg-info/10 text-info',
  danger: 'border-danger/30 bg-danger/10 text-danger',
};

@Component({
  selector: 'app-badge',
  template: `<span [class]="classes()"><ng-content /></span>`,
})
export class Badge {
  readonly tone = input<BadgeTone>('neutral');

  protected readonly classes = computed(
    () => `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONE_CLASSES[this.tone()]}`
  );
}
