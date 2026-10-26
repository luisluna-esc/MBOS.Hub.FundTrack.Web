import { Component, computed, input, output } from '@angular/core';
import { ShortcutDirective } from '../../directives/shortcut.directive';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-dialog',
  imports: [ShortcutDirective, TranslatePipe],
  templateUrl: './dialog.html',
})
export class Dialog {
  readonly title = input<string | null>(null);
  readonly saveDisabled = input(true);
  readonly saveLabel = input<string | null>(null);
  readonly cancelLabel = input<string | null>(null);
  readonly showCancel = input(true);
  readonly size = input<'default' | 'large'>('default');
  /** Botón opcional entre Cancelar y Guardar (por ejemplo Imprimir); sin etiqueta no se muestra. */
  readonly extraLabel = input<string | null>(null);
  readonly extraDisabled = input(false);

  readonly save = output<void>();
  readonly cancel = output<void>();
  readonly extra = output<void>();

  protected readonly containerClass = computed(() => {
    const width = this.size() === 'large' ? 'w-[min(96vw,90rem)]' : 'w-[min(96vw,64rem)]';
    return `flex max-h-[90vh] ${width} flex-col rounded-lg border border-border bg-surface shadow-xl`;
  });
}
