import { Component, input } from '@angular/core';

// Íconos del menú y de la app en un solo lugar (InvenTrack los tenía repetidos dentro del layout).
// El nombre es el mismo que se guarda en la columna menu.icon de la base.
@Component({
  selector: 'app-icon',
  templateUrl: './icon.html',
  host: { class: 'contents' },
})
export class Icon {
  readonly name = input<string | null>(null);
}
