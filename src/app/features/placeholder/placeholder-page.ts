import { Component, input } from '@angular/core';
import { Icon } from '../../shared/components/icon/icon';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

// Pantalla provisional para cada opción del menú mientras se arman sus vistas reales: así se
// puede recorrer el layout completo. El título y el ícono llegan por el data de la ruta.
@Component({
  selector: 'app-placeholder-page',
  imports: [Icon, TranslatePipe],
  template: `
    <div class="flex flex-col gap-1">
      <h1 class="flex items-center gap-2 text-xl font-semibold text-foreground">
        <app-icon [name]="icon()" />
        {{ titleKey() | translate }}
      </h1>
      <p class="text-sm text-muted-foreground">{{ 'placeholder.description' | translate }}</p>
    </div>

    <div class="mt-6 flex h-64 items-center justify-center rounded-lg border border-dashed border-border bg-surface text-sm text-muted-foreground">
      {{ 'placeholder.comingSoon' | translate }}
    </div>
  `,
})
export class PlaceholderPage {
  readonly titleKey = input('nav.home');
  readonly icon = input<string | null>(null);
}
